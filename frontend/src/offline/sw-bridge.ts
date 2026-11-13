/**
 * Puente entre la aplicación y el service worker.
 *
 * La caché de audio vive en el service worker (solo él puede gestionarla
 * de forma fiable y es quien sirve las respuestas con soporte de Range), así
 * que la aplicación le pide cada operación por mensaje y espera la
 * respuesta por un MessageChannel.
 */

const REQUEST_TIMEOUT_MS = 120_000

export interface CacheAudioResult {
  ok: boolean
  bytes: number
  error?: string
  status?: number
}

interface PendingMessage {
  resolve: (value: never) => void
  timer: number
}

let serviceWorker: ServiceWorker | null = null
let workerPromise: Promise<ServiceWorker | null> | null = null

/**
 * Espera a que haya un service worker controlando la página.
 *
 * `navigator.serviceWorker.ready` resuelve cuando hay uno activo, pero
 * durante el primer arranque puede tardar: si la página se acaba de cargar
 * y el worker se está instalando, se espera a `controllerchange`.
 */
export async function getServiceWorker(): Promise<ServiceWorker | null> {
  if (!('serviceWorker' in navigator)) {
    return null
  }

  if (serviceWorker) {
    return serviceWorker
  }

  workerPromise ??= (async () => {
    try {
      const registration = await navigator.serviceWorker.ready

      serviceWorker = registration.active ?? null

      if (!serviceWorker) {
        return null
      }

      // Si la página todavía no está controlada, se espera al primer
      // `controllerchange`: sin control, los mensajes no llegan al worker.
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, 3000)

          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => {
              window.clearTimeout(timer)
              resolve()
            },
            { once: true },
          )
        })
      }

      return serviceWorker
    } catch {
      return null
    }
  })()

  const worker = await workerPromise

  workerPromise = null

  return worker
}

async function sendMessage<T>(message: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T | null> {
  const worker = await getServiceWorker()

  if (!worker) {
    return null
  }

  return new Promise<T | null>((resolve) => {
    const channel = new MessageChannel()
    const pending: PendingMessage = {
      resolve: resolve as unknown as (value: never) => void,
      timer: 0,
    }

    const timer = window.setTimeout(() => {
      channel.port1.close()
      resolve(null)
    }, timeoutMs)

    pending.timer = timer

    channel.port1.onmessage = (event: MessageEvent<T>) => {
      window.clearTimeout(pending.timer)
      channel.port1.close()
      resolve(event.data)
    }

    worker.postMessage(message, [channel.port2])
  })
}

/** ¿Hay un service worker disponible para gestionar las descargas? */
export async function isOfflineSupported(): Promise<boolean> {
  const worker = await getServiceWorker()

  return worker !== null
}

/**
 * Descarga el audio de una canción a la caché del service worker.
 *
 * `key` es la ruta sin query firmada: identify el fichero de forma estable
 * aunque la URL caduque y se vuelva a pedir.
 */
export async function cacheAudio(key: string, url: string): Promise<CacheAudioResult | null> {
  const response = await sendMessage<{
    type: string
    ok: boolean
    bytes: number
    error?: string
    status?: number
  }>({ type: 'CACHE_AUDIO', key, url })

  if (!response || response.type !== 'CACHE_AUDIO_DONE') {
    return null
  }

  return {
    ok: response.ok,
    bytes: response.bytes ?? 0,
    error: response.error,
    status: response.status,
  }
}

export async function deleteAudio(key: string): Promise<boolean> {
  const response = await sendMessage<{ type: string }>({ type: 'DELETE_AUDIO', key })

  return response?.type === 'DELETE_AUDIO_DONE'
}

export async function clearAudio(): Promise<boolean> {
  const response = await sendMessage<{ type: string }>({ type: 'CLEAR_AUDIO' })

  return response?.type === 'CLEAR_AUDIO_DONE'
}

export async function listAudio(): Promise<string[]> {
  const response = await sendMessage<{ type: string; keys: string[] }>({ type: 'LIST_AUDIO' })

  return response?.type === 'LIST_AUDIO_DONE' ? response.keys : []
}

/**
 * Clave de caché de una canción a partir de su URL firmada.
 *
 * Se descarta la query (expiración y firma): el token de la ruta ya
 * identifica el fichero de forma única y estable.
 */
export function cacheKeyFromUrl(url: string): string {
  const parsed = new URL(url, window.location.origin)

  return parsed.pathname
}
