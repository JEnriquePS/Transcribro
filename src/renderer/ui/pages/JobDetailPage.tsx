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
} from 'lucide-react'
import { useJobPolling } from '../../application/hooks/use-job-polling'
import { ProgressBar } from '../components/ProgressBar'
import { TranscriptViewer } from '../components/TranscriptViewer'
import { LiveTranscript } from '../components/LiveTranscript'
import { ipc } from '../../infrastructure/ipc-client'
import { JobStatus } from '../../../shared/types'
import { useState } from 'react'

function formatOffsetLabel(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { metadata, result, isLoading, error } = useJobPolling(id ?? '', !!id)
  const [retrying, setRetrying] = useState(false)

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
          onClick={() => navigate('/jobs')}
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        type="button"
        onClick={() => navigate('/jobs')}
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
        <div className="flex items-center gap-2">
          <File size={18} className="text-accent-text" />
          <h1 className="text-lg font-semibold text-text-primary">
            {metadata.originalFilename}
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="flex items-center gap-1 text-text-secondary">
              <Cpu size={12} />
              Model
            </span>
            <p className="text-text-primary">{metadata.config.model}</p>
          </div>
          <div>
            <span className="flex items-center gap-1 text-text-secondary">
              <Languages size={12} />
              Language
            </span>
            <p className="text-text-primary">{metadata.config.language}</p>
          </div>
        </div>

        <ProgressBar metadata={metadata} />

        <p className="text-[10px] text-text-muted font-mono">{metadata.id}</p>
      </div>

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
        <TranscriptViewer jobId={metadata.id} result={result} />
      )}
    </div>
  )
}
