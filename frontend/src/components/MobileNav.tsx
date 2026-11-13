import { NavLink } from 'react-router-dom'
import { Home, Library, Search, Upload } from 'lucide-react'
import { cn } from '../lib/format'

const items = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/search', label: 'Buscar', icon: Search, end: false },
  { to: '/library', label: 'Biblioteca', icon: Library, end: false },
  { to: '/upload', label: 'Subir', icon: Upload, end: false },
]

export function MobileNav() {
  return (
    <nav
      className="border-ink-700/80 bg-ink-950/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-lg lg:hidden"
      aria-label="Navegación principal"
    >
      <ul className="grid grid-cols-4">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-accent-soft' : 'text-ink-400 hover:text-ink-100',
                )
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
