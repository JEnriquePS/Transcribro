import { FileVideo, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { JobStatus, type JobMetadata } from "../types";
import { ProgressBar } from "./ProgressBar";

const STATUS_BADGE: Record<JobStatus, { label: string; className: string }> = {
  [JobStatus.PENDING]: {
    label: "Pending",
    className: "bg-gray-600/30 text-gray-400",
  },
  [JobStatus.EXTRACTING]: {
    label: "Extracting",
    className: "bg-blue-500/20 text-blue-400",
  },
  [JobStatus.TRANSCRIBING]: {
    label: "Transcribing",
    className: "bg-cyan-500/20 text-cyan-400",
  },
  [JobStatus.FORMATTING]: {
    label: "Formatting",
    className: "bg-indigo-500/20 text-indigo-400",
  },
  [JobStatus.COMPLETED]: {
    label: "Completed",
    className: "bg-green-500/20 text-green-400",
  },
  [JobStatus.FAILED]: {
    label: "Failed",
    className: "bg-red-500/20 text-red-400",
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
      className="group w-full text-left bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileVideo size={16} className="text-cyan-400 shrink-0" />
          <span className="text-sm text-gray-200 truncate">
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
              className="opacity-0 group-hover:opacity-100 rounded p-1 text-gray-500 hover:text-red-400 transition-all disabled:opacity-50"
              title="Delete job"
            >
              {isDeleting ? (
                <Loader2 size={14} className="animate-spin" />
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
        <div className="flex items-start gap-2 mt-2 text-xs text-red-400 bg-red-400/10 rounded px-2 py-1.5">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span className="line-clamp-2">{job.error}</span>
        </div>
      )}

      <p className="text-[10px] text-gray-600 mt-2 font-mono">
        {job.job_id}
      </p>
    </button>
  );
}
