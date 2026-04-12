import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, Loader2, List, Calendar, Type, ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react'
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
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [sortField, setSortField] = useState<SortField>('name')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({})

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
    if (filter === 'all') return true
    if (filter === 'active') return ACTIVE_STATUSES.has(job.status)
    if (filter === 'completed') return job.status === JobStatus.COMPLETED
    if (filter === 'failed') return job.status === JobStatus.FAILED
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

        {/* Filter chips */}
        {jobs.length > 0 && (
          <div role="group" aria-label="Filter by status" className="flex gap-2 flex-wrap">
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
            <p className="text-sm">No transcriptions match this filter</p>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="mt-2 text-sm text-accent-text hover:text-accent-text transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
            >
              Clear filter
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
