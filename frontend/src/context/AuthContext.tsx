import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, ApiError } from '../lib/api'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  initialising: boolean
  /** La sesión se resolvió con la copia local porque no hay red. */
  offline: boolean
  login: (email: string, password: string) => Promise<User>
  register: (
    name: string,
    email: string,
    password: string,
    passwordConfirmation: string,
  ) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Copia local de la sesión.
 *
 * Sin red no se puede preguntar al servidor si la sesión sigue viva, pero
 * la PWA debe seguir siendo utilizable: se guarda el último usuario
 * conocido y se usa mientras no haya conexión. La copia se borra al cerrar
 * sesión o cuando el servidor responde que la sesión ya no vale.
 */
const USER_CACHE_KEY = 'sonora:user'

function readCachedUser(): User | null {
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY)

    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function writeCachedUser(user: User | null): void {
  try {
    if (user) {
      window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user))
    } else {
      window.localStorage.removeItem(USER_CACHE_KEY)
    }
  } catch {
    // Modo privado o almacenamiento lleno: la app sigue funcionando, solo
    // que sin sesión offline.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initialising, setInitialising] = useState(true)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let cancelled = false

    api
      .me()
      .then((current) => {
        if (cancelled) {
          return
        }

        setUser(current)
        setOffline(false)
        writeCachedUser(current)
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        // 401: la sesión no vale (o no hay). Se descarta la copia local.
        if (error instanceof ApiError && error.status === 401) {
          writeCachedUser(null)

          return
        }

        // Cualquier otro fallo es de red: se mantiene la sesión cacheada
        // para que la PWA siga siendo utilizable sin conexión.
        const cached = readCachedUser()

        if (cached) {
          setUser(cached)
          setOffline(true)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInitialising(false)
        }
      })

    const onUnauthorized = () => {
      setUser(null)
      writeCachedUser(null)
    }

    window.addEventListener('auth:unauthorized', onUnauthorized)

    return () => {
      cancelled = true
      window.removeEventListener('auth:unauthorized', onUnauthorized)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const current = await api.login(email, password)
    setUser(current)
    setOffline(false)
    writeCachedUser(current)

    return current
  }, [])

  const register = useCallback(
    async (name: string, email: string, password: string, passwordConfirmation: string) => {
      const current = await api.register(name, email, password, passwordConfirmation)
      setUser(current)
      setOffline(false)
      writeCachedUser(current)

      return current
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      writeCachedUser(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, initialising, offline, login, register, logout }),
    [user, initialising, offline, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }

  return context
}
