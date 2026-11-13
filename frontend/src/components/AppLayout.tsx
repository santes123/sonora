import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { MobileNav } from './MobileNav'
import { PlayerBar } from './PlayerBar'

export function AppLayout() {
  return (
    <div className="min-h-dvh">
      <a
        href="#contenido"
        className="focus:bg-accent sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-lg focus:px-4 focus:py-2 focus:text-white"
      >
        Saltar al contenido
      </a>

      <Sidebar />

      <div className="lg:pl-72">
        <Topbar />
        <main
          id="contenido"
          className="mx-auto w-full max-w-7xl px-4 pt-6 pb-56 sm:px-6 lg:px-10 lg:pb-32"
        >
          <Outlet />
        </main>
      </div>

      <PlayerBar />
      <MobileNav />
    </div>
  )
}
