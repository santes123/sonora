import { MAX_OFFLINE_BYTES, OFFLINE_QUOTA_RATIO } from './constants'

/**
 * Política de cuota offline.
 *
 * El navegador no da un número fijo: `navigator.storage.estimate()` informa
 * del uso y de la cuota total, que cambian según el dispositivo y lo que
 * ocupen otras apps. Aquí se traduce eso a un presupuesto concreto:
 *
 * - Nunca se pasa del 50 % de la cuota del navegador: no se monopoliza el
 *   dispositivo y el navegador puede seguir reservando espacio.
 * - Nunca se pasa de 1 GB: por encima de eso la descarga offline deja de
 *   ser razonable en un móvil.
 * - Las descargas que ya tenemos no se cuentan como "espacio libre": si no,
 *   el presupuesto encogería con cada descarga y acabaríamos expulsando lo
 *   que acabamos de bajar.
 */

export interface StorageEstimate {
  /** Bytes usados en total por el origen. */
  usage: number
  /** Cuota total del origen. */
  quota: number
}

export interface OfflineBudget {
  /** Presupuesto total en bytes para las descargas. */
  limit: number
  /** Bytes que ocupa ahora mismo lo descargado. */
  used: number
  /** Bytes que quedan libres dentro del presupuesto. */
  available: number
}

export function estimateStorage(): Promise<StorageEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return Promise.resolve(null)
  }

  return navigator.storage
    .estimate()
    .then((estimate) => ({
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
    }))
    .catch(() => null)
}

/**
 * Calcula el presupuesto offline.
 *
 * @param estimate  Uso y cuota del navegador (puede ser null si no está disponible).
 * @param used      Bytes que ocupan las descargas actuales.
 */
export function calculateBudget(estimate: StorageEstimate | null, used: number): OfflineBudget {
  if (!estimate || !Number.isFinite(estimate.quota) || estimate.quota <= 0) {
    // Sin datos de cuota no se descarga nada: es mejor fallar que llenar el
    // dispositivo sin control.
    return { limit: 0, used, available: 0 }
  }

  const otherUsage = Math.max(0, estimate.usage - used)
  const freeForUs = Math.max(0, estimate.quota - otherUsage)
  const limit = Math.min(MAX_OFFLINE_BYTES, Math.floor(freeForUs * OFFLINE_QUOTA_RATIO))

  return {
    limit,
    used,
    available: Math.max(0, limit - used),
  }
}

/**
 * ¿El navegador permite pedir almacenamiento persistente?
 *
 * Sin persistencia, el navegador puede borrar las descargas cuando le
 * parezca (o cuando le falte espacio). Con ella, el usuario tiene que
 * autorizarlo explícitamente.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return false
  }

  try {
    if (await navigator.storage.persisted()) {
      return true
    }

    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function isPersistentStorageGranted(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) {
    return false
  }

  try {
    return await navigator.storage.persisted()
  } catch {
    return false
  }
}

/** Convierte bytes a una cantidad legible (KB, MB, GB). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent

  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`
}
