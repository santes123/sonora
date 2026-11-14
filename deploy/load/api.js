// Pruebas de carga de la API de Sonora (k6).
//
//   k6 run -e BASE_URL=https://music.antoniogmportfolio.online deploy/load/api.js
//
// Variables de entorno (con valores por defecto razonables):
//   BASE_URL        origen de la API (por defecto http://localhost:8080)
//   VUS             usuarios virtuales concurrentes (10)
//   DURATION        duración de la prueba (2m)
//   RATE            peticiones/segundo del escenario de catálogo (20)
//   THRESHOLD_P95   límite de latencia p95 en ms (400)
//   THRESHOLD_ERR   límite de tasa de error (0.01)
//
// Escenario por defecto: usuarios autenticados leyendo catálogo y histéorial.
// Opcional: STREAMING=1 añade la descarga con Range del audio firmado.

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '')
const VUS = Number(__ENV.VUS || 10)
const DURATION = __ENV.DURATION || '2m'
const RATE = Number(__ENV.RATE || 20)
const P95_LIMIT = Number(__ENV.THRESHOLD_P95 || 400)
const ERR_LIMIT = Number(__ENV.THRESHOLD_ERR || 0.01)
const STREAMING = (__ENV.STREAMING || '0') === '1'

const apiErrors = new Rate('api_errors')
const apiDuration = new Trend('api_duration', true)
const authOk = new Counter('auth_ok')
const authFail = new Counter('auth_fail')
const streamOk = new Counter('stream_ok')

export const options = {
  scenarios: {
    catalogo: {
      executor: 'ramping-arrival-rate',
      startRate: RATE / 2,
      timeUnit: '1s',
      preAllocatedVUs: VUS,
      maxVUs: VUS * 2,
      stages: [
        { target: RATE, duration: '30s' },
        { target: RATE, duration: DURATION },
        { target: 0, duration: '15s' },
      ],
      exec: 'catalogo',
    },
    busqueda: {
      executor: 'constant-vus',
      vus: Math.max(1, Math.floor(VUS / 4)),
      duration: DURATION,
      exec: 'busqueda',
    },
  },
  thresholds: {
    api_errors: [`rate<${ERR_LIMIT}`],
    api_duration: [`p(95)<${P95_LIMIT}`],
    http_req_failed: [`rate<${ERR_LIMIT}`],
    checks: ['rate>0.99'],
  },
}

/** Token CSRF de Sanctum (mismo patrón que el frontend). */
function csrfHeaders(jar) {
  const cookie = jar.get('XSRF-TOKEN')
  if (!cookie) return {}
  return { 'X-XSRF-TOKEN': decodeURIComponent(cookie.value) }
}

/** Login con sesión propia de cada VU. */
function login(jar, email, password) {
  jar.clear()
  http.get(`${BASE_URL}/sanctum/csrf-cookie`, { tags: { name: 'csrf' } })

  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: Object.assign({ 'Content-Type': 'application/json' }, csrfHeaders(jar)),
      tags: { name: 'auth.login' },
    },
  )

  if (res.status === 200) {
    authOk.add(1)
  } else {
    authFail.add(1)
  }
  return res.status === 200
}

/** GET autenticado con métricas. */
function get(path, jar, name) {
  const res = http.get(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
    tags: { name },
  })
  const ok = check(res, { [`${name} 200`]: (r) => r.status === 200 })
  apiErrors.add(!ok)
  apiDuration.add(res.timings.duration)
  return res
}

export function setup() {
  // URL firmada de audio para el escenario de streaming (no requiere sesión).
  const jar = http.cookieJar();
  const email = `load+setup@sonora.test`
  const password = `Load-${Date.now()}`

  const reg = http.post(
    `${BASE_URL}/api/v1/auth/register`,
    JSON.stringify({ name: 'Load Setup', email, password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth.register' } },
  )

  let signedUrl = null
  if (reg.status === 200 || reg.status === 422) {
    jar.clear()
    http.get(`${BASE_URL}/sanctum/csrf-cookie`, { tags: { name: 'csrf' } })
    const loginRes = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({ email, password }),
      {
        headers: Object.assign({ 'Content-Type': 'application/json' }, csrfHeaders(jar)),
        tags: { name: 'auth.login' },
      },
    )
    if (loginRes.status === 200) {
      const songs = http.get(`${BASE_URL}/api/v1/songs?per_page=1`, {
        headers: { Accept: 'application/json' },
        tags: { name: 'songs.index' },
      })
      const body = songs.json('data') || []
      if (body.length > 0) {
        const ids = body.map((s) => s.id)
        const urls = http.post(
          `${BASE_URL}/api/v1/offline/urls`,
          JSON.stringify({ song_ids: ids }),
          {
            headers: Object.assign({ 'Content-Type': 'application/json' }, csrfHeaders(jar)),
            tags: { name: 'offline.urls' },
          },
        )
        const first = urls.json('data.0.url')
        if (first) signedUrl = first
      }
    }
  }

  return { signedUrl }
}

export function catalogo() {
  const jar = http.cookieJar()
  const email = `load+${__VU}@sonora.test`
  const password = `Load-${__VU}-${Date.now()}`

  if (!login(jar, email, password)) {
    sleep(1)
    return
  }

  get('/api/v1/songs?per_page=20', jar, 'songs.index')
  get('/api/v1/artists', jar, 'artists.index')
  get('/api/v1/albums', jar, 'albums.index')
  get('/api/v1/playlists', jar, 'playlists.index')
  get('/api/v1/me/favorites', jar, 'me.favorites')
  get('/api/v1/history', jar, 'history.index')
  get('/api/v1/auth/me', jar, 'auth.me')

  sleep(Math.random() * 2)
}

export function busqueda() {
  const jar = http.cookieJar()
  const email = `load+busca+${__VU}@sonora.test`
  const password = `Load-${__VU}-${Date.now()}`

  if (!login(jar, email, password)) {
    sleep(1)
    return
  }

  const termas = ['verano', 'luz', 'noche', 'cancion', 'a']
  for (const term of termas) {
    get(`/api/v1/songs?search=${encodeURIComponent(term)}&per_page=10`, jar, 'songs.search')
  }

  sleep(Math.random())
}

export function teardown(data) {
  if (!data || !data.signedUrl) return
  // La URL firmada caduca por sí sola; no hay nada que limpiar.
}
