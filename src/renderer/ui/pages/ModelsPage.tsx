import { useCallback, useEffect, useState } from 'react'
import {
  HardDrive,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  Circle,
  X,
  Star,
} from 'lucide-react'
import { ipc } from '../../infrastructure/ipc-client'
import type { ModelInfo } from '../../../shared/types'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface ModelDownloadStatus {
  readonly status: string
  readonly sizeMb?: number
  readonly progressMb?: number
}

interface ModelState {
  readonly info: ModelInfo
  readonly downloadStatus: ModelDownloadStatus | null
  readonly action: 'idle' | 'downloading' | 'deleting'
}

function formatSize(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`
}

export function ModelsPage() {
  const [models, setModels] = useState<readonly ModelState[]>([])
  const [defaultModel, setDefaultModel] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modelToDelete, setModelToDelete] = useState<string | null>(null)

  const fetchModels = useCallback(async () => {
    try {
      const data = await ipc.listModels()
      setDefaultModel(data.default)

      const states: ModelState[] = data.models.map((info) => ({
        info,
        downloadStatus: null,
        action: 'idle',
      }))
      setModels(states)

      const statuses = await Promise.all(
        data.models.map((m) => ipc.getModelStatus(m.name).catch(() => null)),
      )
      setModels(states.map((s, i) => ({ ...s, downloadStatus: statuses[i] })))
    } catch {
      setError('Failed to load models')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  // Poll downloading models
  useEffect(() => {
    const downloading = models.some((m) => m.action === 'downloading')
    if (!downloading) return

    const interval = setInterval(async () => {
      const updated = await Promise.all(
        models.map(async (m) => {
          if (m.action !== 'downloading') return m
          try {
            const status = await ipc.getModelStatus(m.info.name)
            if (status.status === 'ready') {
              return {
                ...m,
                info: { ...m.info, available: true },
                downloadStatus: status,
                action: 'idle' as const,
              }
            }
            if (status.status === 'failed' || status.status === 'not_downloaded') {
              return { ...m, downloadStatus: status, action: 'idle' as const }
            }
            return { ...m, downloadStatus: status }
          } catch {
            return m
          }
        }),
      )
      setModels(updated)
    }, 2000)

    return () => clearInterval(interval)
  }, [models])

  const handleDownload = async (name: string) => {
    setModels((prev) =>
      prev.map((m) => (m.info.name === name ? { ...m, action: 'downloading' } : m)),
    )
    try {
      await ipc.downloadModel(name)
    } catch {
      setModels((prev) =>
        prev.map((m) => (m.info.name === name ? { ...m, action: 'idle' } : m)),
      )
    }
  }

  const handleCancelDownload = async (name: string) => {
    try {
      await ipc.cancelDownload(name)
      setModels((prev) =>
        prev.map((m) =>
          m.info.name === name
            ? { ...m, downloadStatus: { status: 'not_downloaded' }, action: 'idle' }
            : m,
        ),
      )
    } catch {
      // Polling will update status
    }
  }

  const handleSetDefault = async (name: string) => {
    try {
      await ipc.setDefaultModel(name)
      setDefaultModel(name)
    } catch {
      // Ignore
    }
  }

  const handleDelete = (name: string) => {
    setModelToDelete(name)
  }

  const confirmDelete = async () => {
    if (!modelToDelete) return
    const name = modelToDelete
    setModelToDelete(null)
    setModels((prev) =>
      prev.map((m) => (m.info.name === name ? { ...m, action: 'deleting' } : m)),
    )
    try {
      await ipc.deleteModel(name)
      setModels((prev) =>
        prev.map((m) =>
          m.info.name === name
            ? {
                ...m,
                info: { ...m.info, available: false },
                downloadStatus: { status: 'not_downloaded' },
                action: 'idle',
              }
            : m,
        ),
      )
    } catch {
      setModels((prev) =>
        prev.map((m) => (m.info.name === name ? { ...m, action: 'idle' } : m)),
      )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin motion-reduce:animate-none text-text-secondary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-sm text-error bg-error-muted border border-error rounded px-3 py-2">
          {error}
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
          <HardDrive size={22} className="text-accent-text" />
          Models
        </h1>
        <p className="text-sm text-text-secondary mt-1">Manage whisper.cpp models</p>
      </div>

      <div className="space-y-2">
        {models.map((model) => {
          const isDefault = model.info.name === defaultModel
          const isReady = model.info.available
          const isDownloading = model.action === 'downloading'
          const isDeleting = model.action === 'deleting'
          const progressMb = model.downloadStatus?.progressMb

          return (
            <div
              key={model.info.name}
              className="flex items-center justify-between bg-surface border border-border-default rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {isReady ? (
                  <CheckCircle2 size={18} className="text-success shrink-0" />
                ) : isDownloading ? (
                  <Loader2 size={18} className="animate-spin motion-reduce:animate-none text-accent-text shrink-0" />
                ) : (
                  <Circle size={18} className="text-text-muted shrink-0" />
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {model.info.name}
                    </span>
                    {isDefault && (
                      <span className="flex items-center gap-0.5 text-[10px] text-warning bg-warning-muted px-1.5 py-0.5 rounded-full">
                        <Star size={10} />
                        default
                      </span>
                    )}
                  </div>
                  {isDownloading && progressMb != null ? (
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 bg-surface-elevated rounded-full h-2 min-w-[120px]">
                        <div
                          className="h-2 rounded-full bg-accent transition-all duration-500"
                          style={{
                            width: `${Math.min(Math.round((progressMb / model.info.sizeMb) * 100), 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-text-secondary whitespace-nowrap font-mono">
                        {formatSize(progressMb)} / {formatSize(model.info.sizeMb)}
                        <span className="text-accent-text ml-2">
                          {Math.min(Math.round((progressMb / model.info.sizeMb) * 100), 100)}%
                        </span>
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-text-secondary">
                      {formatSize(model.info.sizeMb)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                {isReady ? (
                  <>
                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(model.info.name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border-default text-text-secondary hover:text-warning hover:border-warning transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        title="Set as default model"
                      >
                        <Star size={13} />
                        Set default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(model.info.name)}
                      disabled={isDeleting || isDefault}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border-default text-text-secondary hover:text-error hover:border-error transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                      title={isDefault ? 'Cannot delete default model' : 'Delete model'}
                    >
                      {isDeleting ? (
                        <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                      Delete
                    </button>
                  </>
                ) : isDownloading ? (
                  <button
                    type="button"
                    onClick={() => handleCancelDownload(model.info.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border-default text-text-secondary hover:text-error hover:border-error transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                    title="Cancel download"
                  >
                    <X size={13} />
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDownload(model.info.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border-default text-text-secondary hover:text-accent-text hover:border-accent transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    <Download size={13} />
                    Download
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        isOpen={modelToDelete !== null}
        title="Eliminar modelo"
        message={`Se eliminar\u00e1 permanentemente el modelo '${modelToDelete ?? ''}' del disco. Esta acci\u00f3n no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => setModelToDelete(null)}
        variant="danger"
      />
    </div>
  )
}
