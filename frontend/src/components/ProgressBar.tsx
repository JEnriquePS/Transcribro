import { Check } from "lucide-react";
import { JobStatus, type JobMetadata } from "../types";

interface StageConfig {
  readonly key: "extraction_progress" | "transcription_progress" | "formatting_progress";
  readonly label: string;
  readonly activeStatus: JobStatus;
}

const STAGES: readonly StageConfig[] = [
  { key: "extraction_progress", label: "Extracting Audio", activeStatus: JobStatus.EXTRACTING },
  { key: "transcription_progress", label: "Transcribing", activeStatus: JobStatus.TRANSCRIBING },
  { key: "formatting_progress", label: "Formatting", activeStatus: JobStatus.FORMATTING },
];

const STATUS_ORDER: Record<string, number> = {
  [JobStatus.PENDING]: -1,
  [JobStatus.EXTRACTING]: 0,
  [JobStatus.TRANSCRIBING]: 1,
  [JobStatus.FORMATTING]: 2,
  [JobStatus.COMPLETED]: 3,
  [JobStatus.FAILED]: -1,
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

interface ProgressBarProps {
  readonly metadata: JobMetadata;
}

export function ProgressBar({ metadata }: ProgressBarProps) {
  const { status, progress } = metadata;
  const currentIndex = STATUS_ORDER[status] ?? -1;
  const overallPct = Math.round(progress * 100);
  const isFailed = status === JobStatus.FAILED;
  const isCompleted = status === JobStatus.COMPLETED;

  return (
    <div className="space-y-2">
      {STAGES.map((stage, i) => {
        const stageProgress = metadata[stage.key];
        const pct = Math.round(stageProgress * 100);
        const isActive = status === stage.activeStatus;
        const isDone = stageProgress >= 1.0;
        const isPending = i > currentIndex && !isCompleted;
        const isFailedStage = isFailed && isActive;

        let barColor = "bg-gray-800";
        let labelColor = "text-gray-600";
        let pctText = "—";

        if (isCompleted || isDone) {
          barColor = "bg-cyan-500/60";
          labelColor = "text-gray-400";
          pctText = "";
        } else if (isFailedStage) {
          barColor = "bg-red-500";
          labelColor = "text-red-400";
          pctText = `${pct}%`;
        } else if (isActive) {
          barColor = "bg-cyan-400";
          labelColor = "text-cyan-300";
          pctText = `${pct}%`;
        } else if (isPending) {
          labelColor = "text-gray-600";
          pctText = "—";
        }

        return (
          <div key={stage.key} className="flex items-center gap-3">
            <span className={`text-xs w-28 shrink-0 ${labelColor}`}>
              {stage.label}
            </span>
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-10 text-right shrink-0">
              {isDone || isCompleted ? (
                <Check size={14} className="inline text-cyan-400" />
              ) : (
                <span className={`text-xs font-mono ${labelColor}`}>{pctText}</span>
              )}
            </span>
          </div>
        );
      })}

      {/* Overall + duration */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-800/50">
        <span className="text-xs font-mono text-gray-500">
          Overall: {overallPct}%
        </span>
        {isCompleted && metadata.duration_seconds != null && (
          <span className="text-xs text-gray-500">
            Completed in {formatDuration(metadata.duration_seconds)}
          </span>
        )}
        {isFailed && metadata.duration_seconds != null && (
          <span className="text-xs text-red-400/60">
            Failed after {formatDuration(metadata.duration_seconds)}
          </span>
        )}
      </div>
    </div>
  );
}
