import { useState } from 'react'
import { FolderOpen, Loader2 } from 'lucide-react'
import { ipc } from '../../infrastructure/ipc-client'
import { toast } from 'sonner'

interface DownloadButtonsProps {
  readonly jobId: string
  readonly formats: readonly string[]
}

export function DownloadButtons({ jobId, formats }: DownloadButtonsProps) {
  const [revealing, setRevealing] = useState<string | null>(null)

  const handleReveal = async (format: string) => {
    setRevealing(format)
    try {
      const { filePath } = await ipc.downloadFile(jobId, format)
      await ipc.revealFile(filePath)
    } catch {
      toast.error('No se pudo abrir el archivo')
    } finally {
      setRevealing(null)
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {formats.map((format) => (
        <button
          key={format}
          type="button"
          disabled={revealing !== null}
          onClick={() => handleReveal(format)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated border border-border-default rounded text-sm text-text-primary hover:border-accent hover:text-accent-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          {revealing === format ? (
            <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
          ) : (
            <FolderOpen size={14} />
          )}
          <span className="uppercase">{format}</span>
        </button>
      ))}
    </div>
  )
}
