import { useCallback, useRef, useState } from 'react'
import { Upload, X, File } from 'lucide-react'
import { ipc } from '../../infrastructure/ipc-client'

function fileBasename(filePath: string): string {
  return filePath.replace(/.*[\\/]/, '')
}

function dedupe(paths: string[]): string[] {
  return [...new Set(paths)]
}

interface FileUploaderProps {
  readonly onFilesSelected: (paths: string[]) => void
}

export function FileUploader({ onFilesSelected }: FileUploaderProps) {
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const setPaths = useCallback(
    (paths: string[]) => {
      setSelectedPaths(paths)
      onFilesSelected(paths)
    },
    [onFilesSelected],
  )

  const handleSelectClick = async () => {
    const paths = await ipc.selectFiles()
    if (paths.length > 0) {
      const next = dedupe([...selectedPaths, ...paths])
      setPaths(next)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!dropRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
      .map((f) => window.electronAPI.getFilePath(f))
      .filter(Boolean)
    if (dropped.length > 0) {
      const next = dedupe([...selectedPaths, ...dropped])
      setPaths(next)
    }
  }

  const removeFile = (index: number) => {
    const next = selectedPaths.filter((_, i) => i !== index)
    setSelectedPaths(next)
    onFilesSelected(next)
  }

  return (
    <div className="space-y-3">
      <div
        ref={dropRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? 'border-accent bg-accent/5'
            : 'border-border-default hover:border-accent hover:bg-surface-elevated'
        }`}
        onClick={handleSelectClick}
        role="button"
        tabIndex={0}
        aria-label="Select media files"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleSelectClick()
          }
        }}
      >
        <Upload size={24} className="mx-auto mb-2 text-text-muted" />
        <p className="text-sm text-text-secondary">
          <span className="text-accent-text font-medium">Click to browse</span>{' '}
          or drag &amp; drop video/audio files
        </p>
        <p className="text-xs text-text-muted mt-1">
          MP4, MKV, AVI, MOV, WEBM, MP3, WAV, FLAC, OGG, M4A
        </p>
      </div>

      {selectedPaths.length > 0 && (
        <ul className="space-y-1.5">
          {selectedPaths.map((filePath, i) => (
            <li
              key={filePath}
              className="flex items-center gap-2 bg-surface-elevated border border-border-default rounded px-3 py-2 text-sm"
            >
              <File size={14} className="text-accent-text shrink-0" />
              <span className="flex-1 truncate text-text-primary">
                {fileBasename(filePath)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(i)
                }}
                aria-label={`Remove ${fileBasename(filePath)}`}
                className="text-text-muted hover:text-error transition-colors focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
