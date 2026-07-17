import { useEffect, useRef, useState, useCallback } from 'react'
import { Copy, Check } from 'lucide-react'
import { ipc } from '../../infrastructure/ipc-client'

const POLL_INTERVAL = 2000

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface LiveTranscriptProps {
  readonly jobId: string
  readonly isActive: boolean
}

export function LiveTranscript({ jobId, isActive }: LiveTranscriptProps) {
  const [data, setData] = useState<{ segments: { start: number; end: number; text: string }[]; text: string }>({
    segments: [],
    text: '',
  })
  const [copied, setCopied] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchTranscript = useCallback(async () => {
    try {
      const result = await ipc.getPartialTranscript(jobId)
      setData(result)
      setHasLoaded(true)
    } catch {
      // Silently ignore fetch errors during polling
    }
  }, [jobId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount/jobId change
    fetchTranscript()
    if (!isActive) return
    const interval = setInterval(fetchTranscript, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchTranscript, isActive])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [data.segments.length])

  const handleCopy = async () => {
    if (!data.text) return
    await navigator.clipboard.writeText(data.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (hasLoaded && data.segments.length === 0 && !isActive) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
            </span>
          )}
          <span className="text-xs text-text-secondary font-medium">
            {isActive ? 'Live transcript' : 'Partial transcript'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!data.text}
          aria-label="Copiar transcripción"
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
          title="Copy transcript"
        >
          {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
        </button>
      </div>

      <div
        ref={scrollRef}
        aria-live="polite"
        className="bg-surface border border-border-default rounded-lg p-4 max-h-64 overflow-y-auto"
      >
        {data.segments.length > 0 ? (
          <div className="space-y-1">
            {data.segments.map((segment, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="font-mono text-accent-text text-xs shrink-0 pt-0.5">
                  [{formatTimestamp(segment.start)}]
                </span>
                <span className="text-text-primary">{segment.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted italic">
            {isActive ? 'Waiting for transcript...' : 'No transcript available'}
          </p>
        )}
      </div>
    </div>
  )
}
