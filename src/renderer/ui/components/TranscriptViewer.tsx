import { useState, useEffect, useCallback, useRef } from 'react'
import { List, Copy, Check, Loader2, FileText, Braces, Captions, Globe, Download } from 'lucide-react'
import { ipc } from '../../infrastructure/ipc-client'
import { toast } from 'sonner'
import type { TranscriptResult } from '../../../shared/types'

type Tab = 'segments' | 'txt' | 'json' | 'srt' | 'vtt'

const TAB_ICONS: Record<Tab, React.ComponentType<{ size?: number }>> = {
  segments: List,
  txt: FileText,
  json: Braces,
  srt: Captions,
  vtt: Globe,
}

const FORMAT_TABS: readonly { key: Tab; label: string }[] = [
  { key: 'segments', label: 'Segments' },
  { key: 'txt', label: 'TXT' },
  { key: 'json', label: 'JSON' },
  { key: 'srt', label: 'SRT' },
  { key: 'vtt', label: 'VTT' },
]

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface TranscriptViewerProps {
  readonly jobId: string
  readonly result: TranscriptResult
  readonly onSeek?: (seconds: number) => void
  readonly activeSegmentIndex?: number | null
}

export function TranscriptViewer({ jobId, result, onSeek, activeSegmentIndex }: TranscriptViewerProps) {
  const [tab, setTab] = useState<Tab>('segments')
  const [previews, setPreviews] = useState<Partial<Record<Tab, string>>>({})
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const activeRowRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (tab === 'segments') {
      activeRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [activeSegmentIndex, tab])

  const fetchPreview = useCallback(
    async (format: Tab) => {
      if (format === 'segments' || previews[format] != null) return
      setLoadingPreview(true)
      try {
        const { content } = await ipc.getFileContent(jobId, format)
        setPreviews((prev) => ({ ...prev, [format]: content }))
      } catch {
        setPreviews((prev) => ({ ...prev, [format]: 'Failed to load preview' }))
      } finally {
        setLoadingPreview(false)
      }
    },
    [jobId, previews],
  )

  useEffect(() => {
    fetchPreview(tab)
  }, [tab, fetchPreview])

  const currentContent = tab === 'segments' ? result.fullText : (previews[tab] ?? '')

  const handleCopy = async () => {
    const text =
      tab === 'segments'
        ? result.segments.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`).join('\n')
        : currentContent
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = async () => {
    const format = tab === 'segments' ? 'txt' : tab
    setDownloading(true)
    try {
      const { filePath, fileName } = await ipc.downloadFile(jobId, format)
      const { saved } = await ipc.saveFile(filePath, fileName)
      if (saved) toast.success(`${fileName} guardado correctamente.`)
    } catch {
      toast.error('No se pudo descargar el archivo')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Tabs + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-0.5 bg-surface-elevated rounded p-0.5 overflow-x-auto">
          {FORMAT_TABS.map(({ key, label }) => {
            const Icon = TAB_ICONS[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                  tab === key
                    ? 'bg-border-default text-accent-text'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!currentContent}
            aria-label="Copiar contenido"
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-label="Descargar archivo"
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
          >
            {downloading ? (
              <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Download size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-surface border border-border-default rounded-lg p-4 max-h-96 overflow-y-auto">
        {loadingPreview ? (
          <div className="flex justify-center py-4">
            <Loader2 size={18} className="animate-spin motion-reduce:animate-none text-text-secondary" />
          </div>
        ) : tab === 'segments' ? (
          <div className="space-y-1">
            {result.segments.map((s, i) => {
              const isActive = i === activeSegmentIndex
              const rowClass = `flex gap-3 text-sm rounded px-1 -mx-1 py-0.5 transition-colors ${
                isActive ? 'bg-accent-text/10' : ''
              }`
              return onSeek ? (
                <button
                  key={i}
                  ref={isActive ? (activeRowRef as React.RefObject<HTMLButtonElement>) : undefined}
                  type="button"
                  onClick={() => onSeek(s.start)}
                  aria-label={`Ir a ${formatTimestamp(s.start)}`}
                  aria-current={isActive ? 'true' : undefined}
                  className={`${rowClass} text-left w-full hover:bg-surface-elevated cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
                >
                  <span className="font-mono text-accent-text text-xs shrink-0 pt-0.5">
                    [{formatTimestamp(s.start)}]
                  </span>
                  <span className="text-text-primary">{s.text}</span>
                </button>
              ) : (
                <div
                  key={i}
                  ref={isActive ? (activeRowRef as React.RefObject<HTMLDivElement>) : undefined}
                  className={rowClass}
                >
                  <span className="font-mono text-accent-text text-xs shrink-0 pt-0.5">
                    [{formatTimestamp(s.start)}]
                  </span>
                  <span className="text-text-primary">{s.text}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <pre className="text-xs text-text-primary whitespace-pre-wrap font-mono">{currentContent}</pre>
        )}
      </div>
    </div>
  )
}
