import { Check } from 'lucide-react'
import { JobStatus, type JobMetadata } from '../../../shared/types'

interface StageConfig {
  readonly key: 'extractionProgress' | 'transcriptionProgress' | 'formattingProgress'
  readonly label: string
  readonly activeStatus: JobStatus
}

const STAGES: readonly StageConfig[] = [
  { key: 'extractionProgress', label: 'Extracting Audio', activeStatus: JobStatus.EXTRACTING },
  { key: 'transcriptionProgress', label: 'Transcribing', activeStatus: JobStatus.TRANSCRIBING },
  { key: 'formattingProgress', label: 'Formatting', activeStatus: JobStatus.FORMATTING },
]

const STATUS_ORDER: Record<string, number> = {
  [JobStatus.PENDING]: -1,
  [JobStatus.EXTRACTING]: 0,
  [JobStatus.TRANSCRIBING]: 1,
  [JobStatus.FORMATTING]: 2,
  [JobStatus.COMPLETED]: 3,
  [JobStatus.FAILED]: -1,
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

interface ProgressBarProps {
  readonly metadata: JobMetadata
}

export function ProgressBar({ metadata }: ProgressBarProps) {
  const { status, progress } = metadata
  const currentIndex = STATUS_ORDER[status] ?? -1
  const overallPct = Math.round(progress * 100)
  const isFailed = status === JobStatus.FAILED
  const isCompleted = status === JobStatus.COMPLETED

  return (
    <div className="space-y-2">
      {STAGES.map((stage, i) => {
        const stageProgress = metadata[stage.key]
        const pct = Math.round(stageProgress * 100)
        const isActive = status === stage.activeStatus
        const isDone = stageProgress >= 1.0
        const isPending = i > currentIndex && !isCompleted
        const isFailedStage = isFailed && isActive

        let barColor = 'bg-surface-elevated'
        let labelColor = 'text-text-muted'
        let pctText = '\u2014'

        if (isCompleted || isDone) {
          barColor = 'bg-accent'
          labelColor = 'text-text-secondary'
          pctText = ''
        } else if (isFailedStage) {
          barColor = 'bg-error'
          labelColor = 'text-error'
          pctText = `${pct}%`
        } else if (isActive) {
          barColor = 'bg-accent'
          labelColor = 'text-accent-text'
          pctText = `${pct}%`
        } else if (isPending) {
          labelColor = 'text-text-muted'
          pctText = '\u2014'
        }

        return (
          <div key={stage.key} className="flex items-center gap-3">
            <span className={`text-xs w-28 shrink-0 ${labelColor}`}>
              {stage.label}
            </span>
            <div
              className="flex-1 bg-surface-elevated rounded-full h-2"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={stage.label}
            >
              <div
                className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 text-right shrink-0">
              {isDone || isCompleted ? (
                <Check size={14} className="inline text-accent-text" />
              ) : (
                <span className={`text-xs font-mono ${labelColor}`}>{pctText}</span>
              )}
            </span>
          </div>
        )
      })}

      {/* Overall + duration */}
      <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
        <span className="text-xs font-mono text-text-secondary" aria-live="polite">
          Overall: {overallPct}%
        </span>
        {isCompleted && metadata.durationSeconds != null && (
          <span className="text-xs text-text-secondary">
            Completed in {formatDuration(metadata.durationSeconds)}
          </span>
        )}
        {isFailed && metadata.durationSeconds != null && (
          <span className="text-xs text-error">
            Failed after {formatDuration(metadata.durationSeconds)}
          </span>
        )}
      </div>
    </div>
  )
}
