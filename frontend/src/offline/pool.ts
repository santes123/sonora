/**
 * Ejecuta tareas con un límite de concurrencia.
 *
 * Descargar una playlist entera son decenas de peticiones de audio. Lanzarlas
 * todas a la vez saturaría la conexión (y el ancho de banda de cada
 * usuario), así que se procesan por tandas. La función es pura y fácil de
 * testear: no toca red ni almacenamiento.
 */

export async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return
  }

  const limit = Math.max(1, Math.min(concurrency, items.length))
  let cursor = 0

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1

      const item = items[index]

      if (item === undefined) {
        continue
      }

      await worker(item, index)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => run()))
}
