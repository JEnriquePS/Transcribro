import React, { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  Inbox,
  Pencil,
  PanelLeft,
  PanelLeftClose,
  Trash2,
  Check,
  X,
} from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'
import type { Folder as FolderType } from '../../../shared/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface FolderNode extends FolderType {
  children: FolderNode[]
}

const COLLAPSED_STORAGE_KEY = 'folderSidebarCollapsed'

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildTree(folders: readonly FolderType[]): FolderNode[] {
  const map = new Map<string, FolderNode>()
  for (const f of folders) map.set(f.id, { ...f, children: [] })
  const roots: FolderNode[] = []
  for (const f of folders) {
    const node = map.get(f.id)!
    if (f.parentId && map.has(f.parentId)) {
      map.get(f.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sort = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    nodes.forEach((n) => sort(n.children))
  }
  sort(roots)
  return roots
}

// ── CreateInput ────────────────────────────────────────────────────────────────

interface CreateInputProps {
  readonly depth: number
  readonly onConfirm: (name: string) => Promise<void>
  readonly onCancel: () => void
}

function CreateInput({ depth, onConfirm, onCancel }: CreateInputProps) {
  const [value, setValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const commit = async () => {
    const trimmed = value.trim()
    if (!trimmed) {
      onCancel()
      return
    }
    setIsSaving(true)
    try {
      await onConfirm(trimmed)
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') void commit()
    else if (e.key === 'Escape') onCancel()
  }

  return (
    <div
      className="flex items-center gap-1 py-1 pr-1"
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
    >
      <FolderPlus size={13} className="text-accent-text shrink-0" aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (!isSaving) onCancel() }}
        placeholder="Nombre..."
        aria-label="New folder name"
        className="flex-1 min-w-0 text-xs bg-surface-elevated border border-accent rounded px-1.5 py-0.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <button
        type="button"
        onClick={() => void commit()}
        disabled={isSaving}
        aria-label="Crear carpeta"
        className="rounded p-0.5 text-success hover:text-success disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Check size={12} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancelar"
        className="rounded p-0.5 text-text-secondary hover:text-error focus-visible:ring-2 focus-visible:ring-accent"
      >
        <X size={12} />
      </button>
    </div>
  )
}

// ── FolderItem ─────────────────────────────────────────────────────────────────

interface FolderItemProps {
  readonly folder: FolderType
  readonly depth: number
  readonly isSelected: boolean
  readonly hasChildren: boolean
  readonly isExpanded: boolean
  readonly onSelect: () => void
  readonly onToggle: () => void
  readonly onRename: (name: string) => Promise<void>
  readonly onDelete: () => void
  readonly onCreateSubfolder: () => void
}

function FolderItem({
  folder,
  depth,
  isSelected,
  hasChildren,
  isExpanded,
  onSelect,
  onToggle,
  onRename,
  onDelete,
  onCreateSubfolder,
}: FolderItemProps) {
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
      await onRename(trimmed)
    } finally {
      setIsSaving(false)
      setIsEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation()
    if (e.key === 'Enter') void commitEdit(e)
    else if (e.key === 'Escape') cancelEdit(e)
  }

  const FolderIcon = isSelected ? FolderOpen : Folder

  if (isEditing) {
    return (
      <div
        className="flex items-center gap-1 py-1.5 pr-1"
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <span className="w-[18px] shrink-0" aria-hidden="true" />
        <FolderIcon size={14} className="text-accent-text shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => void commitEdit()}
          onClick={(e) => e.stopPropagation()}
          aria-label="Rename folder"
          className="flex-1 min-w-0 text-xs bg-surface-elevated border border-accent rounded px-1.5 py-0.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          onClick={(e) => void commitEdit(e)}
          disabled={isSaving}
          aria-label="Confirmar renombrado"
          className="rounded p-0.5 text-success hover:text-success transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Check size={12} />
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          aria-label="Cancelar renombrado"
          className="rounded p-0.5 text-text-secondary hover:text-error transition-colors focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <div
      className="group flex items-center gap-0.5 rounded"
      style={{ paddingLeft: `${depth * 12}px` }}
    >
      {/* Toggle collapse/expand */}
      {hasChildren ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle() }}
          aria-label={isExpanded ? `Colapsar ${folder.name}` : `Expandir ${folder.name}`}
          aria-expanded={isExpanded}
          className="shrink-0 rounded p-0.5 text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      ) : (
        <span className="w-[18px] shrink-0" aria-hidden="true" />
      )}

      {/* Folder name */}
      <button
        type="button"
        onClick={onSelect}
        className={`flex-1 flex items-center gap-1.5 text-left px-1 py-1.5 rounded text-xs truncate transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          isSelected
            ? 'bg-accent-text/10 text-accent-text font-medium'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
        }`}
        aria-current={isSelected ? 'true' : undefined}
      >
        <FolderIcon size={14} className="shrink-0" aria-hidden="true" />
        <span className="truncate">{folder.name}</span>
      </button>

      {/* Action buttons (visible on hover) */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onCreateSubfolder() }}
        aria-label={`Nueva subcarpeta en ${folder.name}`}
        className="opacity-0 group-hover:opacity-100 shrink-0 rounded p-0.5 text-text-secondary hover:text-accent-text transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <FolderPlus size={11} />
      </button>
      <button
        type="button"
        onClick={startEdit}
        aria-label={`Renombrar carpeta ${folder.name}`}
        className="opacity-0 group-hover:opacity-100 shrink-0 rounded p-0.5 text-text-secondary hover:text-accent-text transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Pencil size={11} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Eliminar carpeta ${folder.name}`}
        className="opacity-0 group-hover:opacity-100 shrink-0 rounded p-0.5 text-text-secondary hover:text-error transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

// ── FolderSidebar ──────────────────────────────────────────────────────────────

interface FolderSidebarProps {
  readonly folders: readonly FolderType[]
  readonly selectedFolderId: string | null | undefined
  readonly onSelect: (folderId: string | null | undefined) => void
  readonly onCreateFolder: (name: string, parentId?: string | null) => Promise<void>
  readonly onRenameFolder: (folderId: string, name: string) => Promise<void>
  readonly onDeleteFolder: (folderId: string) => Promise<void>
}

export function FolderSidebar({
  folders,
  selectedFolderId,
  onSelect,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: FolderSidebarProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  // undefined = not creating, null = creating at root, string = creating under folder with that id
  const [creatingUnder, setCreatingUnder] = useState<string | null | undefined>(undefined)
  const [folderToDelete, setFolderToDelete] = useState<FolderNode | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(isCollapsed))
    } catch {
      // localStorage unavailable — collapse state simply won't persist across reloads
    }
  }, [isCollapsed])

  const tree = buildTree(folders)

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const startCreateUnder = (parentId: string | null) => {
    if (typeof parentId === 'string') {
      setExpandedIds((prev) => new Set([...prev, parentId]))
    }
    setCreatingUnder(parentId)
  }

  const handleConfirmCreate = async (name: string, parentId: string | null) => {
    await onCreateFolder(name, parentId ?? undefined)
    setCreatingUnder(undefined)
  }

  const confirmDelete = async () => {
    if (!folderToDelete) return
    const folder = folderToDelete
    setFolderToDelete(null)
    await onDeleteFolder(folder.id)
  }

  const deleteMessage =
    folderToDelete && folderToDelete.children.length > 0
      ? `Se eliminará la carpeta "${folderToDelete.name}" y todas sus subcarpetas. Los trabajos dentro quedarán sin carpeta. Esta acción no se puede deshacer.`
      : `Se eliminará la carpeta "${folderToDelete?.name}". Los trabajos dentro quedarán sin carpeta. Esta acción no se puede deshacer.`

  function renderTree(nodes: FolderNode[], depth: number): React.ReactNode {
    return nodes.map((node) => {
      const isExpanded = expandedIds.has(node.id)
      return (
        <React.Fragment key={node.id}>
          <FolderItem
            folder={node}
            depth={depth}
            isSelected={selectedFolderId === node.id}
            hasChildren={node.children.length > 0}
            isExpanded={isExpanded}
            onSelect={() => onSelect(node.id)}
            onToggle={() => toggleExpanded(node.id)}
            onRename={(name) => onRenameFolder(node.id, name)}
            onDelete={() => setFolderToDelete(node)}
            onCreateSubfolder={() => startCreateUnder(node.id)}
          />
          {isExpanded && (
            <>
              {renderTree(node.children, depth + 1)}
              {creatingUnder === node.id && (
                <CreateInput
                  depth={depth + 1}
                  onConfirm={(name) => handleConfirmCreate(name, node.id)}
                  onCancel={() => setCreatingUnder(undefined)}
                />
              )}
            </>
          )}
        </React.Fragment>
      )
    })
  }

  if (isCollapsed) {
    return (
      <aside aria-label="Carpetas" className="shrink-0 flex flex-col items-center pt-0.5">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          aria-label="Expandir panel de carpetas"
          aria-expanded={false}
          className="rounded p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <PanelLeft size={16} aria-hidden="true" />
        </button>
      </aside>
    )
  }

  return (
    <aside
      aria-label="Carpetas"
      className="w-44 shrink-0 flex flex-col gap-1 border-r border-border-default pr-3"
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end pb-1">
        <button
          type="button"
          onClick={() => setIsCollapsed(true)}
          aria-label="Colapsar panel de carpetas"
          aria-expanded={true}
          className="rounded p-1 text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <PanelLeftClose size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Static entries */}
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className={`flex items-center gap-1.5 text-left px-2 py-1.5 rounded text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          selectedFolderId === undefined
            ? 'bg-accent-text/10 text-accent-text font-medium'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
        }`}
        aria-current={selectedFolderId === undefined ? 'true' : undefined}
      >
        <FolderOpen size={14} aria-hidden="true" />
        All
      </button>

      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`flex items-center gap-1.5 text-left px-2 py-1.5 rounded text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          selectedFolderId === null
            ? 'bg-accent-text/10 text-accent-text font-medium'
            : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
        }`}
        aria-current={selectedFolderId === null ? 'true' : undefined}
      >
        <Inbox size={14} aria-hidden="true" />
        Sin carpeta
      </button>

      {folders.length > 0 && (
        <div className="border-t border-border-default my-1" role="separator" />
      )}

      {/* Folder tree */}
      <div className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
        {renderTree(tree, 0)}
        {creatingUnder === null && (
          <CreateInput
            depth={0}
            onConfirm={(name) => handleConfirmCreate(name, null)}
            onCancel={() => setCreatingUnder(undefined)}
          />
        )}
      </div>

      {/* Create root folder button */}
      {creatingUnder === undefined && (
        <button
          type="button"
          onClick={() => startCreateUnder(null)}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-text-secondary hover:text-accent-text hover:bg-surface-elevated transition-colors mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <FolderPlus size={13} aria-hidden="true" />
          Nueva carpeta
        </button>
      )}

      <ConfirmDialog
        isOpen={folderToDelete !== null}
        title="Eliminar carpeta"
        message={deleteMessage}
        confirmLabel="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => setFolderToDelete(null)}
        variant="danger"
      />
    </aside>
  )
}
