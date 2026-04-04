import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold text-text-primary">
          P&aacute;gina no encontrada
        </h1>
        <p className="text-sm text-text-secondary">
          La p&aacute;gina que buscas no existe.
        </p>
        <Link
          to="/"
          className="inline-block px-4 py-2 bg-accent hover:bg-accent-hover text-text-inverse font-medium rounded transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
