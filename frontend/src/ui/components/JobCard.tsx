import { useEffect, useRef, useState } from "react";
import { FileVideo, AlertCircle, Trash2, Loader2, Pencil, Check, X } from "lucide-react";
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
  readonly onRename?: (jobId: string, newName: string) => Promise<void>;
}

export function JobCard({ job, onClick, onDelete, isDeleting, onRename }: JobCardProps) {
  const badge = STATUS_BADGE[job.status];
  const displayName = job.display_name ?? job.original_filename;

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayName);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync edit value when display name changes from server
  useEffect(() => {
    if (!isEditing) setEditValue(displayName);
  }, [displayName, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(displayName);
    setIsEditing(true);
  };

  const cancelEdit = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    setIsEditing(false);
    setEditValue(displayName);
  };

  const commitEdit = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === displayName) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onRename?.(job.job_id, trimmed);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") commitEdit(e);
    else if (e.key === "Escape") cancelEdit(e);
  };

  return (
    <div className="group relative w-full bg-surface border border-border-default rounded-lg p-4 hover:border-border-default transition-colors">
      {/* Top row: filename / input + badge + actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Left: icon + filename or edit input */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileVideo size={16} className="text-accent-text shrink-0" />
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={() => commitEdit()}
              onClick={(e) => e.stopPropagation()}
              aria-label="Rename job"
              className="flex-1 min-w-0 text-sm bg-surface-elevated border border-accent rounded px-2 py-0.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1 focus:ring-offset-surface"
            />
          ) : (
            <button
              type="button"
              onClick={onClick}
              className="text-sm text-text-primary truncate text-left hover:text-accent-text transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
              aria-label={`Ver trabajo ${displayName}`}
            >
              {displayName}
            </button>
          )}
        </div>

        {/* Right: badge + action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${badge.className}`}
          >
            {badge.label}
          </span>

          {isEditing ? (
            <>
              <button
                type="button"
                onClick={commitEdit}
                disabled={isSaving}
                aria-label="Confirmar nombre"
                className="rounded p-1 text-success hover:text-success transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                {isSaving ? (
                  <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <Check size={14} />
                )}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                aria-label="Cancelar edición"
                className="rounded p-1 text-text-secondary hover:text-error transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <X size={14} />
              </button>
            </>
          ) : (
            <>
              {onRename && (
                <button
                  type="button"
                  onClick={startEdit}
                  aria-label={`Renombrar trabajo ${displayName}`}
                  className="opacity-0 group-hover:opacity-100 rounded p-1 text-text-secondary hover:text-accent-text transition-all focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:opacity-100"
                >
                  <Pencil size={14} />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isDeleting}
                  aria-label={`Eliminar trabajo ${displayName}`}
                  className="opacity-0 group-hover:opacity-100 rounded p-1 text-text-secondary hover:text-error transition-all disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface focus-visible:opacity-100"
                >
                  {isDeleting ? (
                    <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Progress bar (active jobs) */}
      {isActive(job.status) && <ProgressBar metadata={job} />}

      {/* Error message */}
      {job.status === JobStatus.FAILED && job.error && (
        <div className="flex items-start gap-2 mt-2 text-xs text-error bg-error-muted rounded px-2 py-1.5">
          <AlertCircle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span className="line-clamp-2">{job.error}</span>
        </div>
      )}

      {/* Job ID (hidden from screen readers) */}
      <p aria-hidden="true" className="text-[10px] text-text-muted mt-2 font-mono">
        {job.job_id}
      </p>
    </div>
  );
}
