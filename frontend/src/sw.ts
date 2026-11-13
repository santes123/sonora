/// <reference lib="webworker" />

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

/**
 * Service worker propio de Sonora.
 *
 * Se escribe a mano, sin Workbox, por dos razones:
 *
 * 1. La caché de audio necesita control explícito (qué se descarga, cuánto
 *    cabe y cómo se borra). Workbox en modo `generateSW` solo permite reglas
 *    por URL, y en modo `injectManifest` sigue trajinando con sus
 *    dependencias.
 * 2. Un service worker sin importaciones se puede evaluar en desarrollo
 *    (Vite lo sirve tal cual), lo que permite probar la descarga offline
 *    sin construir la aplicación.
 *
 * Responsabilidades:
 * 1. Precachear la aplicación (shell) para que la PWA arranque sin red.
 * 2. Servir el audio descargado desde la caché, con soporte de Range para
 *    que se pueda saltar a cualquier punto de la canción.
 * 3. Exponer un puente por mensajes para descargar, listar y borrar audios.
 *
 * La URL firmada caduca a las pocas horas, así que la clave de caché es la
 * ruta sin query (`/api/v1/media/<token>`): el token es el base64 de la
 * ruta interna del fichero, única y estable para cada canción.
 */

/** Caché de los audios descargados. */
const AUDIO_CACHE = 'sonora-audio-v1'

/** Caché del shell de la aplicación. */
const PRECACHE = 'sonora-precache-v1'

/** Prefijo de las URLs de medios servidas con token firmado. */
const MEDIA_PREFIX = '/api/v1/media/'

/** Ruta del shell precacheado (primera carga de la SPA). */
const APP_SHELL = '/index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE)
      const manifest = self.__WB_MANIFEST ?? []

      // `addAll` es todo o nada: si un recurso falla, no se cachea ninguno.
      // Se cachean de uno en uno para que un icono ausente no impida
      // instalar la aplicación entera.
      await Promise.allSettled(
        manifest.map(async (entry) => {
          const response = await fetch(entry.url, { cache: 'reload' })

          if (response.ok) {
            await cache.put(entry.url, response)
          }
        }),
      )

      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Se limpian las cachés de versiones anteriores (y la de audio, que
      // se vuelve a crear al descargar).
      const names = await caches.keys()

      await Promise.all(
        names
          .filter((name) => name.startsWith('sonora-') && name !== AUDIO_CACHE && name !== PRECACHE)
          .map((name) => caches.delete(name)),
      )

      await self.clients.claim()
    })(),
  )
})

/**
 * Construye una respuesta parcial (206) a partir de la copia completa en
 * caché. Sin esto, el reproductor no podría avanzar dentro de una canción
 * descargada.
 */
function withRangeSupport(request: Request, response: Response): Promise<Response> {
  const range = request.headers.get('range')

  if (!range) {
    return Promise.resolve(response)
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())

  if (!match) {
    return Promise.resolve(response)
  }

  return response.arrayBuffer().then((buffer) => {
    const total = buffer.byteLength
    const hasStart = match[1] !== ''
    const hasEnd = match[2] !== ''

    // "bytes=-500" son los últimos 500 bytes; "bytes=500-" es desde el 500.
    const start = hasStart ? Number(match[1]) : Math.max(total - Number(match[2]), 0)
    const end = hasStart ? (hasEnd ? Math.min(Number(match[2]), total - 1) : total - 1) : total - 1

    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= total || start > end) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${total}` },
      })
    }

    const slice = buffer.slice(start, end + 1)

    return new Response(slice, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': response.headers.get('Content-Type') ?? 'audio/mpeg',
        'Content-Length': String(slice.byteLength),
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
      },
    })
  })
}

async function serveAudio(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const cache = await caches.open(AUDIO_CACHE)
  const cached = await cache.match(url.pathname)

  if (cached) {
    return withRangeSupport(request, cached)
  }

  try {
    return await fetch(request)
  } catch {
    // Sin red y sin copia en caché: el reproductor recibe un error claro
    // en lugar de un fallo de red opaco.
    return new Response(JSON.stringify({ message: 'Sin conexión' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function serveShell(request: Request): Promise<Response> {
  const cache = await caches.open(PRECACHE)
  const cached = await cache.match(APP_SHELL)

  if (cached) {
    return cached
  }

  try {
    return await fetch(request)
  } catch {
    return new Response('Sin conexión', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    return
  }

  // Las respuestas de la API nunca se sirven desde caché: pueden contener
  // datos de la sesión y una respuesta cacheada sería una fuga entre
  // usuarios del mismo navegador.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/sanctum/')) {
    if (!url.pathname.startsWith(MEDIA_PREFIX)) {
      return
    }

    event.respondWith(serveAudio(request))

    return
  }

  // Navegación de la SPA: siempre el shell precacheado.
  if (request.mode === 'navigate') {
    event.respondWith(serveShell(request))
  }
})

interface CacheAudioMessage {
  type: 'CACHE_AUDIO'
  key: string
  url: string
}

interface KeyMessage {
  type: 'DELETE_AUDIO' | 'LIST_AUDIO'
  key?: string
}

type OfflineMessage = CacheAudioMessage | KeyMessage | { type: 'PING' } | { type: 'CLEAR_AUDIO' }

async function handleMessage(message: OfflineMessage): Promise<unknown> {
  switch (message.type) {
    case 'PING':
      return { type: 'PONG', cache: AUDIO_CACHE }

    case 'CACHE_AUDIO': {
      const cache = await caches.open(AUDIO_CACHE)

      try {
        const response = await fetch(message.url)

        if (!response.ok) {
          return {
            type: 'CACHE_AUDIO_DONE',
            key: message.key,
            ok: false,
            status: response.status,
          }
        }

        const buffer = await response.arrayBuffer()

        await cache.put(
          message.key,
          new Response(buffer, {
            status: 200,
            headers: {
              'Content-Type': response.headers.get('Content-Type') ?? 'audio/mpeg',
              'Content-Length': String(buffer.byteLength),
              'Accept-Ranges': 'bytes',
            },
          }),
        )

        return {
          type: 'CACHE_AUDIO_DONE',
          key: message.key,
          ok: true,
          bytes: buffer.byteLength,
        }
      } catch (error) {
        return {
          type: 'CACHE_AUDIO_DONE',
          key: message.key,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }

    case 'DELETE_AUDIO': {
      const cache = await caches.open(AUDIO_CACHE)

      if (message.key) {
        await cache.delete(message.key)
      }

      return { type: 'DELETE_AUDIO_DONE', key: message.key }
    }

    case 'CLEAR_AUDIO': {
      await caches.delete(AUDIO_CACHE)

      return { type: 'CLEAR_AUDIO_DONE' }
    }

    case 'LIST_AUDIO': {
      const cache = await caches.open(AUDIO_CACHE)
      const keys = await cache.keys()

      return {
        type: 'LIST_AUDIO_DONE',
        keys: keys.map((request) => new URL(request.url).pathname),
      }
    }

    default:
      return { type: 'UNKNOWN_MESSAGE' }
  }
}

self.addEventListener('message', (event) => {
  const data = event.data as OfflineMessage | undefined

  if (!data || typeof data.type !== 'string') {
    return
  }

  const reply = (payload: unknown) => {
    const port = event.ports?.[0]

    if (port) {
      port.postMessage(payload)

      return
    }

    event.source?.postMessage(payload)
  }

  event.waitUntil(handleMessage(data).then(reply))
})
