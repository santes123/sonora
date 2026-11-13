import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PageLoader } from './Spinner'

export function ProtectedRoute() {
  const { user, initialising } = useAuth()
  const location = useLocation()

  if (initialising) {
    return <PageLoader label="Comprobando tu sesión" />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { user, initialising } = useAuth()

  if (initialising) {
    return <PageLoader label="Comprobando tu sesión" />
  }

  return user ? <Navigate to="/" replace /> : <Outlet />
}
