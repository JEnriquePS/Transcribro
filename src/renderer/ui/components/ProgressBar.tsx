import { useState } from 'react'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
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
  // Expanded by default while there's something to watch; collapsed once done —
  // always overridable by the user via the toggle below.
  const [expanded, setExpanded] = useState(!isCompleted && !isFailed)

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Ocultar progreso' : 'Mostrar progreso'}
        className="flex items-center justify-center w-full text-text-secondary hover:text-text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
      >
        {expanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
      </button>

      {expanded && (
      <>
      <div className="flex items-start gap-3">
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
            <div key={stage.key} className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className={`text-[11px] truncate ${labelColor}`}>
                  {stage.label}
                </span>
                {isDone || isCompleted ? (
                  <Check size={12} className="text-accent-text shrink-0" />
                ) : (
                  <span className={`text-[11px] font-mono shrink-0 ${labelColor}`}>{pctText}</span>
                )}
              </div>
              <div
                className="bg-surface-elevated rounded-full h-1.5"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={stage.label}
              >
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

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
      </>
      )}
    </div>
  )
}
