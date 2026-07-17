import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  File,
  AlertCircle,
  Loader2,
  RefreshCw,
  Play,
  Cpu,
  Languages,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useJobPolling } from '../../application/hooks/use-job-polling'
import { ProgressBar } from '../components/ProgressBar'
import { TranscriptViewer } from '../components/TranscriptViewer'
import { LiveTranscript } from '../components/LiveTranscript'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ipc } from '../../infrastructure/ipc-client'
import { JobStatus } from '../../../shared/types'
import { AUDIO_EXTENSIONS } from '../../../shared/constants'
import { useEffect, useRef, useState } from 'react'

function formatOffsetLabel(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.')
  return idx === -1 ? '' : filename.slice(idx).toLowerCase()
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { metadata, result, isLoading, error } = useJobPolling(id ?? '', !!id)
  const [retrying, setRetrying] = useState(false)
  const [mediaPort, setMediaPort] = useState<number | null>(null)
  const [originalAvailable, setOriginalAvailable] = useState(true)
  const [extractedAvailable, setExtractedAvailable] = useState(true)
  const [mediaToDelete, setMediaToDelete] = useState<'original' | 'extracted' | null>(null)
  const [deletingKind, setDeletingKind] = useState<'original' | 'extracted' | null>(null)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null)
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null)
  const activeIndexRef = useRef<number | null>(null)

  useEffect(() => {
    ipc.getMediaPort().then(({ port }) => setMediaPort(port)).catch(() => {})
  }, [])

  // Highlight + auto-scroll the transcript segment matching the video's current time.
  // Segments are sorted by start, so binary search finds it in O(log n) — with jobs
  // that have thousands of segments, a linear scan on every `timeupdate` tick adds up.
  useEffect(() => {
    const el = mediaRef.current
    const segments = result?.segments
    if (!el || !segments || segments.length === 0) return

    const handleTimeUpdate = () => {
      const t = el.currentTime
      let lo = 0
      let hi = segments.length - 1
      let found = -1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (segments[mid].start <= t) {
          found = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }
      // Only re-render when the active segment actually changes, not on every tick
      if (found !== activeIndexRef.current) {
        activeIndexRef.current = found
        setActiveSegmentIndex(found)
      }
    }

    el.addEventListener('timeupdate', handleTimeUpdate)
    return () => el.removeEventListener('timeupdate', handleTimeUpdate)
  }, [result, mediaPort, originalAvailable])

  const handleSeek = (seconds: number) => {
    const el = mediaRef.current
    if (!el) return
    el.currentTime = seconds
    void el.play()
  }

  const handleRetry = async (resume: boolean) => {
    if (!id) return
    setRetrying(true)
    try {
      await ipc.retryJob(id, resume)
    } catch {
      // Error will be reflected on next poll
    } finally {
      setRetrying(false)
    }
  }

  const confirmDeleteMedia = async () => {
    if (!metadata || !mediaToDelete) return
    const kind = mediaToDelete
    setMediaToDelete(null)
    setDeletingKind(kind)
    try {
      await ipc.deleteJobMedia(metadata.id, kind)
      if (kind === 'original') setOriginalAvailable(false)
      else setExtractedAvailable(false)
      toast.success(
        kind === 'original'
          ? 'Video/audio original eliminado. La transcripción se conserva.'
          : 'Audio extraído eliminado.',
      )
    } catch {
      toast.error('No se pudo eliminar el archivo. Intenta de nuevo.')
    } finally {
      setDeletingKind(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin motion-reduce:animate-none text-text-secondary" />
      </div>
    )
  }

  if (error || !metadata) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
        >
          <ArrowLeft size={16} />
          Back to transcriptions
        </button>
        <p className="text-sm text-error bg-error-muted border border-error rounded px-3 py-2">
          {error ?? 'Job not found'}
        </p>
      </div>
    )
  }

  const isAudioOriginal = AUDIO_EXTENSIONS.has(getExtension(metadata.originalFilename))

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
      >
        <ArrowLeft size={16} />
        Back to transcriptions
      </button>

      {/* Header */}
      <div
        className="bg-surface border border-border-default rounded-lg p-5 space-y-4"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2 min-w-0">
            <File size={18} className="text-accent-text shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-text-primary truncate">
                {metadata.originalFilename}
              </h1>
              <p className="text-[10px] text-text-muted font-mono">{metadata.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm shrink-0">
            <span className="flex items-center gap-1 text-text-secondary" aria-label={`Model: ${metadata.config.model}`}>
              <Cpu size={12} aria-hidden="true" />
              {metadata.config.model}
            </span>
            <span className="flex items-center gap-1 text-text-secondary" aria-label={`Language: ${metadata.config.language}`}>
              <Languages size={12} aria-hidden="true" />
              {metadata.config.language}
            </span>
          </div>
        </div>

        <ProgressBar metadata={metadata} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Media column */}
        <div className="space-y-4">
          {mediaPort && (
            <>
              {/* Original — copied at job creation, so it's playable from the
                  very first render, regardless of job status */}
              {originalAvailable ? (
                <div className="space-y-1">
                  <p className="text-xs text-text-secondary">Original</p>
                  {isAudioOriginal ? (
                    <audio
                      ref={mediaRef as React.RefObject<HTMLAudioElement>}
                      controls
                      src={`http://127.0.0.1:${mediaPort}/${metadata.id}/original`}
                      onError={() => setOriginalAvailable(false)}
                      className="w-full"
                    />
                  ) : (
                    <video
                      ref={mediaRef as React.RefObject<HTMLVideoElement>}
                      controls
                      src={`http://127.0.0.1:${mediaPort}/${metadata.id}/original`}
                      onError={() => setOriginalAvailable(false)}
                      className="w-full rounded-lg bg-black max-h-96"
                    />
                  )}
                  {metadata.status === JobStatus.COMPLETED && (
                    <button
                      type="button"
                      onClick={() => setMediaToDelete('original')}
                      disabled={deletingKind === 'original'}
                      className="flex items-center gap-1.5 text-xs text-error hover:text-error transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
                    >
                      {deletingKind === 'original' ? (
                        <Loader2 size={12} className="animate-spin motion-reduce:animate-none" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      Eliminar para liberar espacio
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-text-muted italic">
                  El video/audio original fue eliminado para liberar espacio.
                </p>
              )}

              {/* Extracted audio (16kHz mono) — only exists once extraction finished */}
              {metadata.extractionProgress >= 1 && (
                extractedAvailable ? (
                  <div className="space-y-1">
                    <p className="text-xs text-text-secondary">Audio extraído para transcripción</p>
                    <audio
                      controls
                      src={`http://127.0.0.1:${mediaPort}/${metadata.id}/extracted`}
                      onError={() => setExtractedAvailable(false)}
                      className="w-full"
                    />
                    {metadata.status === JobStatus.COMPLETED && (
                      <button
                        type="button"
                        onClick={() => setMediaToDelete('extracted')}
                        disabled={deletingKind === 'extracted'}
                        className="flex items-center gap-1.5 text-xs text-error hover:text-error transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
                      >
                        {deletingKind === 'extracted' ? (
                          <Loader2 size={12} className="animate-spin motion-reduce:animate-none" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        Eliminar para liberar espacio
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted italic">
                    El audio extraído fue eliminado para liberar espacio.
                  </p>
                )
              )}
            </>
          )}
        </div>

        {/* Everything else */}
        <div className="space-y-4">
          {/* Live Transcript during transcription */}
          {metadata.status === JobStatus.TRANSCRIBING && (
            <LiveTranscript jobId={metadata.id} isActive />
          )}

          {/* Partial transcript after failure */}
          {metadata.status === JobStatus.FAILED && (
            <LiveTranscript jobId={metadata.id} isActive={false} />
          )}

          {/* Failed State */}
          {metadata.status === JobStatus.FAILED && (
            <div className="bg-error-muted border border-error rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2 text-error">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Transcription failed</p>
                  {metadata.error && (
                    <p className="text-xs mt-1 opacity-80">{metadata.error}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {metadata.lastOffsetMs != null && metadata.lastOffsetMs > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRetry(true)}
                    disabled={retrying}
                    className="flex items-center gap-1.5 text-xs text-accent-text hover:text-accent-text transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
                  >
                    {retrying ? (
                      <Loader2 size={12} className="animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Play size={12} />
                    )}
                    Resume from {formatOffsetLabel(metadata.lastOffsetMs)}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRetry(false)}
                  disabled={retrying}
                  className="flex items-center gap-1.5 text-xs text-error hover:text-error transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
                >
                  {retrying ? (
                    <Loader2 size={12} className="animate-spin motion-reduce:animate-none" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  Retry from start
                </button>
              </div>
            </div>
          )}

          {/* Completed State */}
          {metadata.status === JobStatus.COMPLETED && result && (
            <TranscriptViewer
              jobId={metadata.id}
              result={result}
              onSeek={handleSeek}
              activeSegmentIndex={activeSegmentIndex}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={mediaToDelete !== null}
        title={mediaToDelete === 'original' ? 'Eliminar video/audio original' : 'Eliminar audio extraído'}
        message={
          mediaToDelete === 'original'
            ? 'Se eliminará el video/audio original de este trabajo para liberar espacio. La transcripción se conserva. Esta acción no se puede deshacer.'
            : 'Se eliminará el audio extraído (usado internamente para la transcripción) para liberar espacio. Esta acción no se puede deshacer.'
        }
        confirmLabel="Eliminar"
        onConfirm={confirmDeleteMedia}
        onCancel={() => setMediaToDelete(null)}
        variant="danger"
      />
    </div>
  )
}
