import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Esta página no existe"
      description="El enlace puede estar roto o la página se ha movido."
      action={
        <Link to="/" className="btn-primary">
          Volver al inicio
        </Link>
      }
    />
  )
}
