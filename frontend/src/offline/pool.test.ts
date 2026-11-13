import { describe, expect, it } from 'vitest'
import { runPool } from './pool'

describe('runPool', () => {
  it('procesa todos los elementos', async () => {
    const processed: number[] = []

    await runPool([1, 2, 3, 4, 5], 2, async (item) => {
      processed.push(item)
    })

    expect(processed.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('respeta el límite de concurrencia', async () => {
    let active = 0
    let maxActive = 0

    await runPool(Array.from({ length: 10 }, (_, index) => index), 3, async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 1))
      active -= 1
    })

    expect(maxActive).toBeLessThanOrEqual(3)
    expect(maxActive).toBeGreaterThan(1)
  })

  it('no hace nada con una lista vacía', async () => {
    let calls = 0

    await runPool([], 4, async () => {
      calls += 1
    })

    expect(calls).toBe(0)
  })

  it('propaga el error de una tarea', async () => {
    await expect(
      runPool([1, 2], 1, async (item) => {
        if (item === 2) {
          throw new Error('fallo')
        }
      }),
    ).rejects.toThrow('fallo')
  })

  it('pasa el índice de cada elemento', async () => {
    const indexes: number[] = []

    await runPool(['a', 'b', 'c'], 1, async (_item, index) => {
      indexes.push(index)
    })

    expect(indexes).toEqual([0, 1, 2])
  })
})
