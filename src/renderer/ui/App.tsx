import { NavLink, Route, Routes } from 'react-router-dom'
import { Upload, List, HardDrive } from 'lucide-react'
import { Toaster } from 'sonner'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeToggle } from './components/ThemeToggle'
import { TranscribroLogo } from './components/TranscribroLogo'
import { UploadPage } from './pages/UploadPage'
import { JobsPage } from './pages/JobsPage'
import { JobDetailPage } from './pages/JobDetailPage'
import { ModelsPage } from './pages/ModelsPage'
import { NotFoundPage } from './pages/NotFoundPage'

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
    isActive
      ? 'bg-surface-elevated text-accent-text'
      : 'text-text-secondary hover:text-text-primary'
  }`
}

export function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-accent focus:text-text-inverse focus:rounded"
      >
        Saltar al contenido principal
      </a>

      <header className="drag border-b border-border-subtle pl-20 pr-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <NavLink
            to="/"
            className="no-drag flex items-center gap-2 text-lg font-bold text-accent-text tracking-tight focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
          >
            <TranscribroLogo size={20} />
            Transcribro
          </NavLink>
          <div className="no-drag flex items-center gap-2">
            <nav className="flex gap-1" aria-label="Navegación principal">
              <NavLink to="/" end className={navLinkClass}>
                <List size={14} />
                Transcriptions
              </NavLink>
              <NavLink to="/upload" className={navLinkClass}>
                <Upload size={14} />
                Upload
              </NavLink>
              <NavLink to="/models" className={navLinkClass}>
                <HardDrive size={14} />
                Models
              </NavLink>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <Toaster position="top-center" richColors closeButton />

      <main id="main-content" className="flex-1 px-6 py-8">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<JobsPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/models" element={<ModelsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  )
}
