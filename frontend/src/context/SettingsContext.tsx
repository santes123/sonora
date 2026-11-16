import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { SiteSettings } from '../types'

interface SettingsContextValue {
  settings: SiteSettings | null
  /** ¿Hay registro público? */
  registrationEnabled: boolean
  /** ¿Los motores de búsqueda pueden indexar el sitio? */
  indexingAllowed: boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

/**
 * Ajustes del sitio para toda la aplicación.
 *
 * Se piden sin sesión porque la interfaz necesita saber si el registro está
 * abierto antes de poder iniciar sesión.
 *
 * Mientras no hay respuesta se asume lo restrictivo (registro cerrado, sin
 * indexación): si el servidor no contesta, lo privado es la opción segura.
 */
const CLOSED: SiteSettings = {
  registration_enabled: false,
  allow_indexing: false,
}

function applyRobotsMeta(indexingAllowed: boolean): void {
  let meta = document.querySelector('meta[name="robots"]')

  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'robots')
    document.head.appendChild(meta)
  }

  meta.setAttribute('content', indexingAllowed ? 'index, follow' : 'noindex, nofollow')
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: api.settings,
    staleTime: 60_000,
  })

  const settings = data ?? CLOSED

  useEffect(() => {
    applyRobotsMeta(settings.allow_indexing)
  }, [settings.allow_indexing])

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings: data ?? null,
      registrationEnabled: settings.registration_enabled,
      indexingAllowed: settings.allow_indexing,
    }),
    [data, settings.registration_enabled, settings.allow_indexing],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSiteSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)

  if (!context) {
    throw new Error('useSiteSettings debe usarse dentro de SettingsProvider')
  }

  return context
}
