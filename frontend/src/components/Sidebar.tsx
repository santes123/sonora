import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AudioLines, Home, Library, ListMusic, LogOut, Search, Upload } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { cn } from '../lib/format'

const navigation = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/search', label: 'Buscar', icon: Search, end: false },
  { to: '/library', label: 'Biblioteca', icon: Library, end: false },
  { to: '/upload', label: 'Subir música', icon: Upload, end: false },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const { data: playlists } = useQuery({
    queryKey: ['playlists', 'mine'],
    queryFn: () => api.playlists(true),
    enabled: Boolean(user),
  })

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className="border-ink-700/70 bg-ink-950/90 fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r px-4 py-6 lg:flex"
      aria-label="Navegación principal"
    >
      <Link to="/" className="flex items-center gap-2 px-2" aria-label="Sonora, inicio">
        <span className="from-accent to-hot flex size-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg">
          <AudioLines className="size-5 text-white" aria-hidden="true" />
        </span>
        <span className="text-lg font-bold tracking-tight text-white">Sonora</span>
      </Link>

      <nav className="mt-8 space-y-1">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-ink-800 text-white'
                  : 'text-ink-300 hover:bg-ink-800/60 hover:text-white',
              )
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-8 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-3">
          <h2 className="text-ink-400 text-xs font-semibold tracking-wider uppercase">
            Tus playlists
          </h2>
          <Link to="/library" className="text-ink-300 hover:text-accent-soft text-xs">
            Ver todas
          </Link>
        </div>

        <div className="mt-2 min-h-0 space-y-0.5 overflow-y-auto">
          {playlists?.data.slice(0, 8).map((playlist) => (
            <NavLink
              key={playlist.id}
              to={`/playlists/${playlist.id}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'text-accent-soft bg-ink-800/80'
                    : 'text-ink-300 hover:bg-ink-800/60 hover:text-white',
                )
              }
            >
              <ListMusic className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{playlist.name}</span>
            </NavLink>
          ))}

          {playlists && playlists.data.length === 0 ? (
            <p className="text-ink-500 px-3 py-2 text-sm">Aún no tienes playlists.</p>
          ) : null}
        </div>
      </div>

      {user ? (
        <div className="border-ink-700 mt-4 flex items-center gap-3 border-t pt-4">
          <span className="from-accent/80 to-hot/80 flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white uppercase">
            {user.name.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="text-ink-400 truncate text-xs">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="icon-btn"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </aside>
  )
}
