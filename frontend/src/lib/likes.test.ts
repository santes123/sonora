import { describe, expect, it } from 'vitest'
import {
  applyIntent,
  createIntentTracker,
  resolveLiked,
  revertIntent,
  type LikeOverrides,
} from './likes'

const song = (id: number, isLiked: boolean) => ({ id, is_liked: isLiked })

describe('resolveLiked', () => {
  it('falls back to the payload value when there is no user decision', () => {
    expect(resolveLiked(song(1, true), {})).toBe(true)
    expect(resolveLiked(song(2, false), {})).toBe(false)
  })

  it('gives priority to the user decision over the payload', () => {
    const overrides: LikeOverrides = { 1: false }

    // El payload aún dice "me gusta" (foto antigua del servidor), pero el
    // usuario acaba de quitarlo: manda la decisión del usuario.
    expect(resolveLiked(song(1, true), overrides)).toBe(false)
  })

  it('does not leak the decision of one song to another', () => {
    const overrides = applyIntent({}, 7, true)

    expect(resolveLiked(song(7, false), overrides)).toBe(true)
    expect(resolveLiked(song(8, false), overrides)).toBe(false)
  })
})

describe('applyIntent', () => {
  it('records the decision without mutating the previous map', () => {
    const before: LikeOverrides = { 1: true }
    const after = applyIntent(before, 2, true)

    expect(after).toEqual({ 1: true, 2: true })
    expect(before).toEqual({ 1: true })
  })
})

describe('revertIntent', () => {
  it('restores the previous state', () => {
    const optimistic = applyIntent({}, 3, true)
    const reverted = revertIntent(optimistic, 3, false)

    expect(resolveLiked(song(3, true), reverted)).toBe(false)
  })
})

describe('createIntentTracker', () => {
  it('treats the latest intention as the current one', () => {
    const tracker = createIntentTracker()

    tracker.set(1, true)
    expect(tracker.isCurrent(1, true)).toBe(true)
    expect(tracker.isCurrent(1, false)).toBe(false)
  })

  it('discards the result of a stale intention', () => {
    const tracker = createIntentTracker()

    // El usuario marca "me gusta" y acto seguido "no me gusta".
    tracker.set(1, true)
    tracker.set(1, false)

    // La respuesta de la primera petición ya no es la intención vigente.
    expect(tracker.isCurrent(1, true)).toBe(false)
    expect(tracker.isCurrent(1, false)).toBe(true)
  })

  it('tracks each song independently', () => {
    const tracker = createIntentTracker()

    tracker.set(1, true)
    tracker.set(2, false)

    expect(tracker.isCurrent(1, true)).toBe(true)
    expect(tracker.isCurrent(2, false)).toBe(true)
    expect(tracker.isCurrent(2, true)).toBe(false)
  })

  it('forgets everything when cleared', () => {
    const tracker = createIntentTracker()

    tracker.set(1, true)
    tracker.clear()

    expect(tracker.isCurrent(1, true)).toBe(false)
  })
})
