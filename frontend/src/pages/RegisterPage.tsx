import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { AuthShell } from '../components/AuthShell'
import { useAuth } from '../context/AuthContext'
import { ApiError, firstError } from '../lib/api'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    setError(null)
    setFieldErrors({})

    try {
      await register(name, email, password, confirmation)
      navigate('/', { replace: true })
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

  const fieldError = (field: string) =>
    fieldErrors[field] ? (
      <p id={`${field}-error`} className="mt-1 text-xs text-red-300">
        {fieldErrors[field]}
      </p>
    ) : null

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Tarda menos de un minuto y empieza a subir y organizar tu música."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-accent-soft font-semibold hover:underline">
            Iniciar sesión
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
          <label htmlFor="name" className="label">
            Nombre
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="field"
            placeholder="Tu nombre"
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'name-error' : undefined}
          />
          {fieldError('name')}
        </div>

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
          {fieldError('email')}
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field pr-11"
              placeholder="Mínimo 8 caracteres, con letras y números"
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : 'password-hint'}
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
          {fieldErrors.password ? null : (
            <p id="password-hint" className="text-ink-400 mt-1 text-xs">
              Al menos 8 caracteres, con letras y números.
            </p>
          )}
          {fieldError('password')}
        </div>

        <div>
          <label htmlFor="password_confirmation" className="label">
            Repite la contraseña
          </label>
          <input
            id="password_confirmation"
            name="password_confirmation"
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="field"
            placeholder="Repite la contraseña"
            aria-invalid={Boolean(fieldErrors.password_confirmation)}
            aria-describedby={
              fieldErrors.password_confirmation ? 'password_confirmation-error' : undefined
            }
          />
          {fieldError('password_confirmation')}
        </div>

        <button type="submit" disabled={pending} className="btn-primary w-full py-2.5">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </AuthShell>
  )
}
