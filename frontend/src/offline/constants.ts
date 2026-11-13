/**
 * Constantes de la política de almacenamiento offline.
 *
 * Este módulo lo usa solo la aplicación (el service worker no necesita
 * conocerlas): el service worker gestiona la caché de audio por mensajes y
 * decide qué se guarda.
 */

/**
 * Tope de almacenamiento offline: 1 GB.
 *
 * Es el límite duro de las descargas del dispositivo. El presupuesto real
 * se calcula con la cuota del navegador (la mitad de lo libre) y nunca
 * supera este valor.
 */
export const MAX_OFFLINE_BYTES = 1024 * 1024 * 1024

/** Porcentaje de la cuota libre del navegador que se puede usar. */
export const OFFLINE_QUOTA_RATIO = 0.5
