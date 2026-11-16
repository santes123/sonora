import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loader2, Save, ShieldCheck, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, firstError } from '../lib/api'
import { formatDate } from '../lib/format'
import type { UserRole } from '../types'

/**
 * Panel de administración.
 *
 * Dos cosas, y ninguna de ellas es abrir el sitio al mundo:
 *
 * - Los ajustes del sitio (registro público e indexación), que se guardan en
 *   la base de datos: se pueden cambiar sin rehacer la imagen ni reiniciar.
 * - El alta de cuentas, que es el sustituto del registro cuando este está
 *   cerrado.
 */
export function AdminPage() {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()

  const isAdmin = user?.role === 'admin'

  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: api.adminSettings,
    enabled: isAdmin,
  })

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.adminUsers(),
    enabled: isAdmin,
  })

  const [registrationEnabled, setRegistrationEnabled] = useState(false)
  const [allowIndexing, setAllowIndexing] = useState(false)

  // Los checkboxes arrancan con lo que dice el servidor: si no se guardan
  // cambios, el formulario refleja el estado real.
  useEffect(() => {
    if (!settingsQuery.data) {
      return
    }

    setRegistrationEnabled(settingsQuery.data.registration_enabled)
    setAllowIndexing(settingsQuery.data.allow_indexing)
  }, [settingsQuery.data])

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [role, setRole] = useState<UserRole>('user')

  const saveSettings = useMutation({
    mutationFn: () =>
      api.updateAdminSettings({
        registration_enabled: registrationEnabled,
        allow_indexing: allowIndexing,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(['admin', 'settings'], saved)
      // El resto de la aplicación lee los ajustes públicos: hay que
      // refrescarlos para que el enlace de registro aparezca o desaparezca.
      void queryClient.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Ajustes guardados.')
    },
    onError: (error) => toast.error(firstError(error)),
  })

  const createUser = useMutation({
    mutationFn: () =>
      api.createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: confirmation,
        role,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      toast.success(`Cuenta creada para ${created.email}.`)
      setName('')
      setEmail('')
      setPassword('')
      setConfirmation('')
      setRole('user')
    },
    onError: (error) => toast.error(firstError(error)),
  })

  const handleCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!name.trim() || !email.trim()) {
      toast.error('El nombre y el correo son obligatorios.')

      return
    }

    if (password !== confirmation) {
      toast.error('La confirmación de contraseña no coincide.')

      return
    }

    createUser.mutate()
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">Administración</h1>
        <p className="text-ink-300 text-sm">
          Esta sección es solo para administradores.
        </p>
        <Link to="/" className="btn-outline inline-flex">
          Volver al inicio
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-white">
          <ShieldCheck className="size-6 text-accent-soft" aria-hidden="true" />
          Administración
        </h1>
        <p className="text-ink-300 mt-2 text-sm">
          Ajustes del sitio y cuentas de usuario.
        </p>
      </header>

      <section
        aria-labelledby="ajustes-heading"
        className="border-ink-700/70 bg-ink-900/40 rounded-2xl border p-6"
      >
        <h2 id="ajustes-heading" className="text-lg font-semibold text-white">
          Ajustes del sitio
        </h2>

        <div className="mt-4 space-y-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={registrationEnabled}
              onChange={(event) => setRegistrationEnabled(event.target.checked)}
              className="accent-accent mt-0.5 size-4"
            />
            <span>
              <span className="block font-medium text-ink-100">Permitir registro público</span>
              <span className="text-ink-400 block">
                Si está desactivado, nadie puede crear una cuenta: solo tú, desde este panel.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={allowIndexing}
              onChange={(event) => setAllowIndexing(event.target.checked)}
              className="accent-accent mt-0.5 size-4"
            />
            <span>
              <span className="block font-medium text-ink-100">
                Permitir indexación por motores de búsqueda
              </span>
              <span className="text-ink-400 block">
                Si está desactivado, <code>robots.txt</code> prohíbe el rastreo y las respuestas
                llevan <code>X-Robots-Tag: noindex</code>.
              </span>
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => saveSettings.mutate()}
          disabled={saveSettings.isPending}
          className="btn-primary mt-5"
        >
          {saveSettings.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Guardar ajustes
        </button>
      </section>

      <section
        aria-labelledby="cuentas-heading"
        className="border-ink-700/70 bg-ink-900/40 rounded-2xl border p-6"
      >
        <h2 id="cuentas-heading" className="flex items-center gap-2 text-lg font-semibold text-white">
          <UserPlus className="size-5 text-accent-soft" aria-hidden="true" />
          Registrar un usuario
        </h2>

        <form onSubmit={handleCreateUser} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="admin-name" className="label">
              Nombre
            </label>
            <input
              id="admin-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field"
              maxLength={120}
              required
            />
          </div>

          <div>
            <label htmlFor="admin-email" className="label">
              Correo electrónico
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field"
              required
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="label">
              Contraseña
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field"
              minLength={8}
              autoComplete="new-password"
              required
            />
            <p className="text-ink-400 mt-1 text-xs">
              Al menos 8 caracteres, con letras y números.
            </p>
          </div>

          <div>
            <label htmlFor="admin-password-confirmation" className="label">
              Repite la contraseña
            </label>
            <input
              id="admin-password-confirmation"
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="field"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="admin-role" className="label">
              Rol
            </label>
            <select
              id="admin-role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="field"
            >
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <button type="submit" disabled={createUser.isPending} className="btn-primary">
              {createUser.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <UserPlus className="size-4" aria-hidden="true" />
              )}
              Crear cuenta
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="listado-heading">
        <h2 id="listado-heading" className="text-lg font-semibold text-white">
          Cuentas ({usersQuery.data?.meta.total ?? 0})
        </h2>

        <ul className="mt-3 space-y-2">
          {usersQuery.data?.data.map((account) => (
            <li
              key={account.id}
              className="border-ink-700/70 bg-ink-900/40 flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{account.name}</p>
                <p className="text-ink-400 truncate text-xs">{account.email}</p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={
                    account.role === 'admin'
                      ? 'text-accent-soft rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold'
                      : 'text-ink-300 rounded-full bg-ink-800 px-2.5 py-1 text-xs'
                  }
                >
                  {account.role === 'admin' ? 'Administrador' : 'Usuario'}
                </span>
                {account.created_at ? (
                  <span className="text-ink-500 hidden text-xs sm:inline">
                    {formatDate(account.created_at)}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        {usersQuery.isLoading ? (
          <p className="text-ink-400 mt-3 text-sm">Cargando cuentas…</p>
        ) : null}

        {usersQuery.data && usersQuery.data.data.length === 0 ? (
          <p className="text-ink-400 mt-3 text-sm">Todavía no hay cuentas.</p>
        ) : null}
      </section>
    </div>
  )
}
