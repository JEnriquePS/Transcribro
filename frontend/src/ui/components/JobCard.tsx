import { FileVideo, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { JobStatus, type JobMetadata } from "../../domain/types";
import { ProgressBar } from "./ProgressBar";

const STATUS_BADGE: Record<JobStatus, { label: string; className: string }> = {
  [JobStatus.PENDING]: {
    label: "Pending",
    className: "bg-status-pending-muted text-status-pending",
  },
  [JobStatus.EXTRACTING]: {
    label: "Extracting",
    className: "bg-status-extracting-muted text-status-extracting",
  },
  [JobStatus.TRANSCRIBING]: {
    label: "Transcribing",
    className: "bg-status-transcribing-muted text-status-transcribing",
  },
  [JobStatus.FORMATTING]: {
    label: "Formatting",
    className: "bg-status-formatting-muted text-status-formatting",
  },
  [JobStatus.COMPLETED]: {
    label: "Completed",
    className: "bg-success-muted text-success",
  },
  [JobStatus.FAILED]: {
    label: "Failed",
    className: "bg-error-muted text-error",
  },
};

function isActive(status: JobStatus): boolean {
  return (
    status === JobStatus.EXTRACTING ||
    status === JobStatus.TRANSCRIBING ||
    status === JobStatus.FORMATTING
  );
}

interface JobCardProps {
  readonly job: JobMetadata;
  readonly onClick: () => void;
  readonly onDelete?: (e: React.MouseEvent) => void;
  readonly isDeleting?: boolean;
}

export function JobCard({ job, onClick, onDelete, isDeleting }: JobCardProps) {
  const badge = STATUS_BADGE[job.status];

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left bg-surface border border-border-default rounded-lg p-4 hover:border-border-default transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileVideo size={16} className="text-accent-text shrink-0" />
          <span className="text-sm text-text-primary truncate">
            {job.original_filename}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}
          >
            {badge.label}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="opacity-0 group-hover:opacity-100 rounded p-1 text-text-secondary hover:text-error transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:opacity-100"
              title="Delete job"
            >
              {isDeleting ? (
                <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
              ) : (
                <Trash2 size={14} />
              )}
            </button>
          )}
        </div>
      </div>

      {isActive(job.status) && (
        <ProgressBar metadata={job} />
      )}

      {job.status === JobStatus.FAILED && job.error && (
        <div className="flex items-start gap-2 mt-2 text-xs text-error bg-error-muted rounded px-2 py-1.5">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span className="line-clamp-2">{job.error}</span>
        </div>
      )}

      <p className="text-[10px] text-text-muted mt-2 font-mono">
        {job.job_id}
      </p>
    </button>
  );
}
