import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthShell } from '../components/AuthShell'
import { useAuth } from '../context/AuthContext'
import { ApiError, firstError } from '../lib/api'

interface LocationState {
  from?: string
}

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const state = location.state as LocationState | null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    setFieldErrors({})

    try {
      await login(email, password)
      navigate(state?.from ?? '/', { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError && caught.errors) {
        const errors: Record<string, string> = {}

        for (const [field, messages] of Object.entries(caught.errors)) {
          if (messages[0]) {
            errors[field] = messages[0]
          }
        }

        setFieldErrors(errors)
      }

      setError(firstError(caught))
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="Inicia sesión"
      subtitle="Accede a tu biblioteca y sigue donde lo dejaste."
      footer={
        <>
          ¿Todavía no tienes cuenta?{' '}
          <Link to="/register" className="text-accent-soft font-semibold hover:underline">
            Crear una cuenta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        ) : null}

        <div>
          <label htmlFor="email" className="label">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field"
            placeholder="tu@correo.com"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          />
          {fieldErrors.email ? (
            <p id="email-error" className="mt-1 text-xs text-red-300">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="password" className="label">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field pr-11"
              placeholder="••••••••"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setVisible((value) => !value)}
              className="text-ink-400 hover:text-ink-100 absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-2"
              aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {visible ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {fieldErrors.password ? (
            <p id="password-error" className="mt-1 text-xs text-red-300">
              {fieldErrors.password}
            </p>
          ) : null}
        </div>

        <button type="submit" disabled={pending} className="btn-primary w-full py-2.5">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </AuthShell>
  )
}
