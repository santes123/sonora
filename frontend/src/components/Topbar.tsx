import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AudioLines, Search, Upload, WifiOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useOffline } from '../context/OfflineContext'

/**
 * Aviso de "sin conexión".
 *
 * Se muestra siempre que el navegador pierde la red: sin conexión solo se
 * puede escuchar lo que está descargado, y conviene saberlo antes de
 * intentarlo.
 */
function OfflineIndicator() {
  const { isOnline } = useOffline()
  const { offline } = useAuth()

  if (isOnline && !offline) {
    return null
  }

  return (
    <span
      className="border-amber-500/40 bg-amber-500/10 text-amber-200 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
      role="status"
    >
      <WifiOff className="size-3.5" aria-hidden="true" />
      Sin conexión
    </span>
  )
}

export function Topbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [term, setTerm] = useState(searchParams.get('q') ?? '')

  useEffect(() => {
    if (location.pathname === '/search') {
      setTerm(searchParams.get('q') ?? '')
    }
  }, [location.pathname, searchParams])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const query = term.trim()
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/search')
  }

  return (
    <header className="border-ink-800/80 bg-ink-950/80 sticky top-0 z-30 border-b backdrop-blur-lg">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link to="/" className="flex items-center gap-2 lg:hidden" aria-label="Sonora, inicio">
          <span className="from-accent to-hot flex size-8 items-center justify-center rounded-lg bg-gradient-to-br">
            <AudioLines className="size-4 text-white" aria-hidden="true" />
          </span>
          <span className="text-base font-bold text-white">Sonora</span>
        </Link>

        <form role="search" onSubmit={handleSubmit} className="relative max-w-md flex-1">
          <label htmlFor="global-search" className="sr-only">
            Buscar canciones, artistas o álbumes
          </label>
          <Search
            className="text-ink-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            id="global-search"
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar canciones, artistas, álbumes…"
            className="field bg-ink-900/80 border-ink-700 focus:bg-ink-900 py-2 pl-9"
          />
        </form>

        <div className="ml-auto flex items-center gap-2">
          <OfflineIndicator />

          <Link to="/upload" className="btn-primary hidden sm:inline-flex">
            <Upload className="size-4" aria-hidden="true" />
            Subir
          </Link>
          <Link to="/upload" className="icon-btn sm:hidden" aria-label="Subir música">
            <Upload className="size-5" aria-hidden="true" />
          </Link>

          {user ? (
            <span
              className="from-accent/80 to-hot/80 ml-1 flex size-9 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white uppercase"
              title={user.name}
            >
              {user.name.slice(0, 1)}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  )
}
