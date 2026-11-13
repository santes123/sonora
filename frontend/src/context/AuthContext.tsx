import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '../lib/api'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  initialising: boolean
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initialising, setInitialising] = useState(true)

  useEffect(() => {
    let cancelled = false

    api
      .me()
      .then((current) => {
        if (!cancelled) {
          setUser(current)
        }
      })
      .catch(() => {
        // 401 esperado cuando no hay sesión.
      })
      .finally(() => {
        if (!cancelled) {
          setInitialising(false)
        }
      })

    const onUnauthorized = () => setUser(null)
    window.addEventListener('auth:unauthorized', onUnauthorized)

    return () => {
      cancelled = true
      window.removeEventListener('auth:unauthorized', onUnauthorized)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const current = await api.login(email, password)
    setUser(current)

    return current
  }, [])

  const register = useCallback(
    async (name: string, email: string, password: string, passwordConfirmation: string) => {
      const current = await api.register(name, email, password, passwordConfirmation)
      setUser(current)

      return current
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, initialising, login, register, logout }),
    [user, initialising, login, register, logout],
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
