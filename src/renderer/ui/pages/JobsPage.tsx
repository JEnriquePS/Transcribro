import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, Loader2, List, Calendar, Type, ArrowDownNarrowWide, ArrowUpNarrowWide, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { JobCard } from '../components/JobCard'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FolderSidebar } from '../components/FolderSidebar'
import { useJobsPolling } from '../../application/hooks/use-job-polling'
import { ipc } from '../../infrastructure/ipc-client'
import { JobStatus, type Folder, type JobMetadata } from '../../../shared/types'

type SortDir = 'desc' | 'asc'
type SortField = 'date' | 'name'
type FilterStatus = 'all' | 'active' | 'completed' | 'failed'

const FILTER_LABELS: Record<FilterStatus, string> = {
  all: 'All',
  active: 'Active',
  completed: 'Completed',
  failed: 'Failed',
}

const ACTIVE_STATUSES = new Set<JobStatus>([
  JobStatus.PENDING,
  JobStatus.EXTRACTING,
  JobStatus.TRANSCRIBING,
  JobStatus.FORMATTING,
])

export function JobsPage() {
  const navigate = useNavigate()

  // ── Folder state ────────────────────────────────────────────────────────────
  // undefined = All, null = Uncategorized, string = specific folder id
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | undefined>(undefined)
  const [folders, setFolders] = useState<readonly Folder[]>([])

  const loadFolders = useCallback(async () => {
    try {
      const data = await ipc.listFolders()
      setFolders(data.folders)
    } catch {
      // Non-critical — don't show toast for folder list errors
    }
  }, [])

  useEffect(() => {
    loadFolders()
  }, [loadFolders])

  // ── Jobs state ──────────────────────────────────────────────────────────────
  const { jobs, isLoading, error } = useJobsPolling(true, selectedFolderId)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [jobToDelete, setJobToDelete] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [sortField, setSortField] = useState<SortField>('date')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({})

  const hasActiveFilters = filter !== 'all' || search.trim() !== '' || dateFrom !== '' || dateTo !== ''

  const clearFilters = () => {
    setFilter('all')
    setSearch('')
    setDateFrom('')
    setDateTo('')
  }

  useEffect(() => {
    if (error) toast.error(error)
  }, [error])

  // ── Folder handlers ─────────────────────────────────────────────────────────

  const handleCreateFolder = async (name: string, parentId?: string | null) => {
    try {
      const folder = await ipc.createFolder(name, parentId)
      setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)))
    } catch {
      toast.error('No se pudo crear la carpeta. Intenta de nuevo.')
    }
  }

  const handleRenameFolder = async (folderId: string, name: string) => {
    try {
      const updated = await ipc.renameFolder(folderId, name)
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? updated : f)).sort((a, b) => a.name.localeCompare(b.name)),
      )
    } catch {
      toast.error('No se pudo renombrar la carpeta. Intenta de nuevo.')
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await ipc.deleteFolder(folderId)
      // Reload fresh list — cascade may have removed descendant folders too
      const { folders: fresh } = await ipc.listFolders()
      setFolders(fresh)
      // If the selected folder or any of its ancestors was deleted, reset to All
      if (typeof selectedFolderId === 'string' && !fresh.some((f) => f.id === selectedFolderId)) {
        setSelectedFolderId(undefined)
      }
    } catch {
      toast.error('No se pudo eliminar la carpeta. Intenta de nuevo.')
    }
  }

  // ── Job handlers ────────────────────────────────────────────────────────────

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setJobToDelete(id)
  }

  const confirmDelete = async () => {
    if (!jobToDelete) return
    const id = jobToDelete
    setJobToDelete(null)
    setDeleting(id)
    try {
      await ipc.deleteJob(id)
      toast.success('Trabajo eliminado correctamente.')
    } catch {
      toast.error('No se pudo eliminar el trabajo. Intenta de nuevo.')
    } finally {
      setDeleting(null)
    }
  }

  const handleRename = async (jobId: string, newName: string) => {
    setNameOverrides((prev) => ({ ...prev, [jobId]: newName }))
    try {
      await ipc.renameJob(jobId, newName)
    } catch {
      setNameOverrides((prev) => {
        const next = { ...prev }
        delete next[jobId]
        return next
      })
      toast.error('No se pudo renombrar el trabajo. Intenta de nuevo.')
    }
  }

  const handleMoveToFolder = async (jobId: string, folderId: string | null) => {
    try {
      await ipc.moveJobToFolder(jobId, folderId)
    } catch {
      toast.error('No se pudo mover el trabajo. Intenta de nuevo.')
    }
  }

  // ── Derived data ────────────────────────────────────────────────────────────

  const jobsWithOverrides: readonly JobMetadata[] = jobs.map((job) =>
    nameOverrides[job.id] != null
      ? { ...job, displayName: nameOverrides[job.id] }
      : job,
  )

  const filtered = jobsWithOverrides.filter((job) => {
    if (filter === 'active' && !ACTIVE_STATUSES.has(job.status)) return false
    if (filter === 'completed' && job.status !== JobStatus.COMPLETED) return false
    if (filter === 'failed' && job.status !== JobStatus.FAILED) return false

    if (search.trim() !== '') {
      const query = search.trim().toLowerCase()
      const name = (job.displayName ?? job.originalFilename).toLowerCase()
      if (!name.includes(query)) return false
    }

    // createdAt is a full ISO timestamp; compare only the date portion so
    // "Hasta" includes the entire selected day, not just its midnight instant.
    const jobDate = job.createdAt?.slice(0, 10) ?? ''
    if (dateFrom !== '' && (jobDate === '' || jobDate < dateFrom)) return false
    if (dateTo !== '' && (jobDate === '' || jobDate > dateTo)) return false

    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    let cmp: number
    if (sortField === 'name') {
      const na = (a.displayName ?? a.originalFilename).toLowerCase()
      const nb = (b.displayName ?? b.originalFilename).toLowerCase()
      cmp = na.localeCompare(nb, undefined, { sensitivity: 'base' })
    } else {
      const ta = a.createdAt ?? ''
      const tb = b.createdAt ?? ''
      cmp = ta.localeCompare(tb)
    }
    return sortDir === 'desc' ? -cmp : cmp
  })

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading && jobs.length === 0) {
    return (
      <div role="status" aria-label="Cargando trabajos" className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin motion-reduce:animate-none text-text-secondary" />
        <span className="sr-only">Cargando trabajos...</span>
      </div>
    )
  }

  if (error) return null

  return (
    <div className="flex gap-6 items-start">
      {/* Folder sidebar */}
      <FolderSidebar
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelect={setSelectedFolderId}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
      />

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
            <List size={22} className="text-accent-text" />
            Transcriptions
          </h1>

          {jobs.length > 0 && (
            <div className="flex items-center rounded border border-border-default overflow-hidden">
              <button
                type="button"
                onClick={() => setSortField((f) => (f === 'date' ? 'name' : 'date'))}
                aria-label={sortField === 'date' ? 'Ordenar por nombre' : 'Ordenar por fecha'}
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors px-2.5 py-1.5 cursor-pointer border-r border-border-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                {sortField === 'date' ? <Calendar size={12} aria-hidden="true" /> : <Type size={12} aria-hidden="true" />}
                {sortField === 'date' ? 'Date' : 'Name'}
              </button>
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                aria-label={sortDir === 'desc' ? 'Orden descendente, click para ascendente' : 'Orden ascendente, click para descendente'}
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors px-2.5 py-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                {sortDir === 'desc'
                  ? <ArrowDownNarrowWide size={13} aria-hidden="true" />
                  : <ArrowUpNarrowWide size={13} aria-hidden="true" />}
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        {jobs.length > 0 && (
          <div className="relative">
            <Search
              size={15}
              aria-hidden="true"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none"
            />
            <label htmlFor="jobs-search" className="sr-only">
              Buscar transcripciones por nombre
            </label>
            <input
              id="jobs-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre de archivo..."
              className="w-full bg-surface-elevated border border-border-default rounded pl-8 pr-8 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {search !== '' && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Filter chips + date range */}
        {jobs.length > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <div role="group" aria-label="Filtrar por estado" className="flex gap-2 flex-wrap">
              {(['all', 'active', 'completed', 'failed'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                    filter === f
                      ? 'bg-accent-text text-white border-accent-text'
                      : 'bg-surface text-text-secondary border-border-default hover:text-text-primary hover:border-border-hover'
                  }`}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <label htmlFor="jobs-date-from" className="sr-only">
                Fecha desde
              </label>
              <input
                id="jobs-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={dateTo || undefined}
                aria-label="Fecha desde"
                className="bg-surface-elevated border border-border-default rounded px-2 py-1 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <span aria-hidden="true">–</span>
              <label htmlFor="jobs-date-to" className="sr-only">
                Fecha hasta
              </label>
              <input
                id="jobs-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom || undefined}
                aria-label="Fecha hasta"
                className="bg-surface-elevated border border-border-default rounded px-2 py-1 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-accent-text hover:text-accent-text transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded px-1"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <Inbox size={40} className="mb-3" />
            <p className="text-sm">
              {selectedFolderId === null
                ? 'No hay trabajos sin carpeta'
                : selectedFolderId !== undefined
                  ? 'Esta carpeta está vacía'
                  : 'No transcriptions yet'}
            </p>
            {selectedFolderId === undefined && (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-3 text-sm text-accent-text hover:text-accent-text transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
              >
                Upload a file to get started
              </button>
            )}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
            <Inbox size={32} className="mb-3 opacity-50" />
            <p className="text-sm">Ninguna transcripción coincide con los filtros</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 text-sm text-accent-text hover:text-accent-text transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onClick={() => navigate(`/jobs/${job.id}`)}
                onDelete={(e) => handleDelete(job.id, e)}
                isDeleting={deleting === job.id}
                onRename={handleRename}
                folders={folders}
                onMoveToFolder={handleMoveToFolder}
              />
            ))}
          </div>
        )}

        <ConfirmDialog
          isOpen={jobToDelete !== null}
          title="Eliminar trabajo"
          message="Se eliminará este trabajo permanentemente. Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          onConfirm={confirmDelete}
          onCancel={() => setJobToDelete(null)}
          variant="danger"
        />
      </div>
    </div>
  )
}
