// Prueba de carga rápida en Node (sin instalar nada).
//
// Se usa para validar el dimensionado en local o en el servidor antes de
// recurrir a k6 (deploy/load/api.js) para pruebas largas y con umbrales.
//
//   node deploy/load/quick.js --url http://localhost:8081 --requests 300 --concurrency 10
//
// Opciones:
//   --url         URL base            (por defecto http://localhost:8081)
//   --requests    peticiones totales  (por defecto 200)
//   --concurrency peticiones a la vez (por defecto 10)
//   --path        ruta a golpear      (por defecto /api/v1/health)

const args = process.argv.slice(2)

function arg(name, fallback) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const baseUrl = (arg('url', 'http://localhost:8081')).replace(/\/$/, '')
const total = Number(arg('requests', 200))
const concurrency = Number(arg('concurrency', 10))
const path = arg('path', '/api/v1/health')

const durations = []
let ok = 0
let fail = 0
const errors = new Map()

function record(duration, status) {
  durations.push(duration)
  if (status >= 200 && status < 400) {
    ok++
  } else {
    fail++
    errors.set(status, (errors.get(status) || 0) + 1)
  }
}

async function worker(id) {
  for (let i = id; i < total; i += concurrency) {
    const started = performance.now()
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { Accept: 'application/json' },
      })
      await res.arrayBuffer()
      record(performance.now() - started, res.status)
    } catch (err) {
      record(performance.now() - started, 0)
      errors.set(`network: ${err.message}`, (errors.get(`network: ${err.message}`) || 0) + 1)
    }
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[index]
}

async function main() {
  const started = performance.now()
  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)))
  const elapsed = (performance.now() - started) / 1000

  const sorted = [...durations].sort((a, b) => a - b)
  const sum = durations.reduce((a, b) => a + b, 0)

  console.log(`\n== ${total} peticiones a ${baseUrl}${path} (concurrencia ${concurrency}) ==`)
  console.log(`Duración:      ${elapsed.toFixed(2)} s`)
  console.log(`Rendimiento:   ${(total / elapsed).toFixed(1)} req/s`)
  console.log(`Éxito:         ${ok} (${((ok / total) * 100).toFixed(1)} %)`)
  console.log(`Fallos:        ${fail}`)
  console.log(`Latencia p50:  ${percentile(sorted, 50).toFixed(1)} ms`)
  console.log(`Latencia p95:  ${percentile(sorted, 95).toFixed(1)} ms`)
  console.log(`Latencia p99:  ${percentile(sorted, 99).toFixed(1)} ms`)
  console.log(`Latencia máx:  ${sorted[sorted.length - 1]?.toFixed(1)} ms`)
  console.log(`Media:         ${(sum / (durations.length || 1)).toFixed(1)} ms`)

  if (errors.size > 0) {
    console.log('\nErrores:')
    for (const [status, count] of errors) {
      console.log(`  ${status}: ${count}`)
    }
  }

  process.exit(fail > 0 ? 1 : 0)
}

main()
