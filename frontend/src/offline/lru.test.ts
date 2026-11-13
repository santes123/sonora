import { describe, expect, it } from 'vitest'
import { freedBytes, selectEvictions, type EvictionCandidate } from './lru'

const candidate = (
  songId: number,
  bytes: number,
  lastAccessedAt: number,
): EvictionCandidate => ({ songId, bytes, lastAccessedAt })

describe('selectEvictions', () => {
  it('expulsa primero lo que hace menos que se escucha', () => {
    const downloads = [
      candidate(1, 100, 1000),
      candidate(2, 100, 3000),
      candidate(3, 100, 2000),
    ]

    const evicted = selectEvictions(downloads, 100)

    expect(evicted.map((item) => item.songId)).toEqual([1])
  })

  it('sigue expulsando hasta liberar lo necesario', () => {
    const downloads = [
      candidate(1, 100, 1000),
      candidate(2, 100, 3000),
      candidate(3, 100, 2000),
    ]

    // Con 250 bytes necesarios y descargas de 100, hay que tirar tres:
    // dos no bastan para liberar lo pedido.
    const evicted = selectEvictions(downloads, 250)

    expect(evicted.map((item) => item.songId)).toEqual([1, 3, 2])
    expect(freedBytes(evicted)).toBe(300)
  })

  it('nunca expulsa las canciones que se están descargando', () => {
    const downloads = [
      candidate(1, 100, 1000),
      candidate(2, 100, 2000),
    ]

    const evicted = selectEvictions(downloads, 150, [1])

    expect(evicted.map((item) => item.songId)).toEqual([2])
  })

  it('no expulsa nada si no hace falta espacio', () => {
    expect(selectEvictions([candidate(1, 100, 1000)], 0)).toEqual([])
    expect(selectEvictions([candidate(1, 100, 1000)], -50)).toEqual([])
  })

  it('devuelve una lista vacía si no hay candidatas', () => {
    expect(selectEvictions([], 500)).toEqual([])
  })

  it('a igualdad de uso expulsa antes la más pequeña', () => {
    const downloads = [candidate(1, 500, 1000), candidate(2, 100, 1000)]

    expect(selectEvictions(downloads, 100).map((item) => item.songId)).toEqual([2])
  })

  it('no modifica la lista original', () => {
    const downloads = [candidate(2, 100, 2000), candidate(1, 100, 1000)]

    selectEvictions(downloads, 100)

    expect(downloads.map((item) => item.songId)).toEqual([2, 1])
  })
})
