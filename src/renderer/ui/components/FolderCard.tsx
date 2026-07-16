import { useEffect, useRef, useState } from 'react'
import { Folder as FolderIcon, Trash2, Loader2, Pencil, Check, X } from 'lucide-react'
import type { Folder } from '../../../shared/types'

interface FolderCardProps {
  readonly folder: Folder
  readonly itemCount: number
  readonly onClick: () => void
  readonly onDelete?: (e: React.MouseEvent) => void
  readonly isDeleting?: boolean
  readonly onRename?: (folderId: string, newName: string) => Promise<void>
}

export function FolderCard({ folder, itemCount, onClick, onDelete, isDeleting, onRename }: FolderCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(folder.name)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isEditing) setEditValue(folder.name)
  }, [folder.name, isEditing])

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditValue(folder.name)
    setIsEditing(true)
  }

  const cancelEdit = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation()
    setIsEditing(false)
    setEditValue(folder.name)
  }

  const commitEdit = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation()
    const trimmed = editValue.trim()
    if (!trimmed || trimmed === folder.name) {
      setIsEditing(false)
      return
    }
    setIsSaving(true)
    try {
      await onRename?.(folder.id, trimmed)
    } finally {
      setIsSaving(false)
      setIsEditing(false)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (e.key === 'Enter') commitEdit(e)
    else if (e.key === 'Escape') cancelEdit(e)
  }

  return (
    <div className="group relative w-full bg-surface border border-border-default rounded-lg p-4 hover:border-border-default transition-colors">
      {/* Top row: folder name / input + item count badge + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FolderIcon size={16} className="text-accent-text shrink-0" />
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={() => commitEdit()}
              onClick={(e) => e.stopPropagation()}
              aria-label="Rename folder"
              className="flex-1 min-w-0 text-sm bg-surface-elevated border border-accent rounded px-2 py-0.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface"
            />
          ) : (
            <button
              type="button"
              onClick={onClick}
              className="text-sm text-text-primary truncate text-left hover:text-accent-text transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
              aria-label={`Abrir carpeta ${folder.name}`}
            >
              {folder.name}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap bg-surface-elevated text-text-secondary">
            {itemCount === 1 ? '1 transcripción' : `${itemCount} transcripciones`}
          </span>

          {isEditing ? (
            <>
              <button
                type="button"
                onClick={commitEdit}
                disabled={isSaving}
                aria-label="Confirmar nombre"
                className="rounded p-1 text-success hover:text-success transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                {isSaving ? (
                  <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Check size={14} />
                )}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                aria-label="Cancelar edición"
                className="rounded p-1 text-text-secondary hover:text-error transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              {onRename && (
                <button
                  type="button"
                  onClick={startEdit}
                  aria-label={`Renombrar carpeta ${folder.name}`}
                  className="opacity-0 group-hover:opacity-100 rounded p-1 text-text-secondary hover:text-accent-text transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:opacity-100"
                >
                  <Pencil size={14} />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isDeleting}
                  aria-label={`Eliminar carpeta ${folder.name}`}
                  className="opacity-0 group-hover:opacity-100 rounded p-1 text-text-secondary hover:text-error transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:opacity-100"
                >
                  {isDeleting ? (
                    <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        {folder.createdAt && (
          <p className="text-[10px] text-text-muted">
            {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(folder.createdAt))}
          </p>
        )}
        <p aria-hidden="true" className="text-[10px] text-text-muted font-mono ml-auto">
          {folder.id}
        </p>
      </div>
    </div>
  )
}
