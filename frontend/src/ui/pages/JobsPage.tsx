import { useNavigate } from "react-router-dom";
import { Inbox, Loader2, ListVideo, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { JobCard } from "../components/JobCard";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useJobsPolling } from "../../application/hooks/useJobPolling";
import { deleteJob, renameJob } from "../../infrastructure/api/client";
import { JobStatus, type JobMetadata } from "../../domain/types";
import { useEffect, useState } from "react";

type SortDir = "desc" | "asc";
type FilterStatus = "all" | "active" | "completed" | "failed";

const FILTER_LABELS: Record<FilterStatus, string> = {
  all: "All",
  active: "Active",
  completed: "Completed",
  failed: "Failed",
};

const ACTIVE_STATUSES = new Set<JobStatus>([
  JobStatus.PENDING,
  JobStatus.EXTRACTING,
  JobStatus.TRANSCRIBING,
  JobStatus.FORMATTING,
]);

export function JobsPage() {
  const navigate = useNavigate();
  const { jobs, isLoading, error } = useJobsPolling(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState<FilterStatus>("all");
  // Optimistic display_name overrides keyed by job_id
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleDelete = (_jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setJobToDelete(_jobId);
  };

  const confirmDelete = async () => {
    if (!jobToDelete) return;
    const id = jobToDelete;
    setJobToDelete(null);
    setDeleting(id);
    try {
      await deleteJob(id);
    } catch {
      toast.error("No se pudo eliminar el trabajo. Intenta de nuevo.");
    } finally {
      setDeleting(null);
    }
  };

  const handleRename = async (jobId: string, newName: string) => {
    // Optimistic update
    setNameOverrides((prev) => ({ ...prev, [jobId]: newName }));
    try {
      await renameJob(jobId, newName);
    } catch {
      // Revert on failure
      setNameOverrides((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      toast.error("No se pudo renombrar el trabajo. Intenta de nuevo.");
    }
  };

  // Apply local name overrides (optimistic rename)
  const jobsWithOverrides: readonly JobMetadata[] = jobs.map((job) =>
    nameOverrides[job.job_id] != null
      ? { ...job, display_name: nameOverrides[job.job_id] }
      : job,
  );

  // Filter
  const filtered = jobsWithOverrides.filter((job) => {
    if (filter === "all") return true;
    if (filter === "active") return ACTIVE_STATUSES.has(job.status);
    if (filter === "completed") return job.status === JobStatus.COMPLETED;
    if (filter === "failed") return job.status === JobStatus.FAILED;
    return true;
  });

  // Sort by created_at (ISO strings sort lexicographically)
  const sorted = [...filtered].sort((a, b) => {
    const ta = a.created_at ?? "";
    const tb = b.created_at ?? "";
    return sortDir === "desc" ? tb.localeCompare(ta) : ta.localeCompare(tb);
  });

  if (isLoading && jobs.length === 0) {
    return (
      <div role="status" aria-label="Cargando trabajos" className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin motion-reduce:animate-none text-text-secondary" />
        <span className="sr-only">Cargando trabajos...</span>
      </div>
    );
  }

  if (error) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
          <ListVideo size={22} className="text-accent-text" />
          Jobs
        </h1>

        {jobs.length > 0 && (
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            aria-label={sortDir === "desc" ? "Ordenar de más antiguo a más nuevo" : "Ordenar de más nuevo a más antiguo"}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors px-2.5 py-1.5 rounded border border-border-default hover:border-border-hover cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <ArrowUpDown size={13} aria-hidden="true" />
            {sortDir === "desc" ? "Newest first" : "Oldest first"}
          </button>
        )}
      </div>

      {/* Filter chips */}
      {jobs.length > 0 && (
        <div role="group" aria-label="Filter by status" className="flex gap-2 flex-wrap">
          {(["all", "active", "completed", "failed"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`text-xs px-3 py-1 rounded-full border transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                filter === f
                  ? "bg-accent-text text-white border-accent-text"
                  : "bg-surface text-text-secondary border-border-default hover:text-text-primary hover:border-border-hover"
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
          <Inbox size={40} className="mb-3" />
          <p className="text-sm">No transcription jobs yet</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-3 text-sm text-accent-text hover:text-accent-text transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
          >
            Upload a video to get started
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
          <Inbox size={32} className="mb-3 opacity-50" />
          <p className="text-sm">No jobs match this filter</p>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="mt-2 text-sm text-accent-text hover:text-accent-text transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((job) => (
            <JobCard
              key={job.job_id}
              job={job}
              onClick={() => navigate(`/jobs/${job.job_id}`)}
              onDelete={(e) => handleDelete(job.job_id, e)}
              isDeleting={deleting === job.job_id}
              onRename={handleRename}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={jobToDelete !== null}
        title="Eliminar trabajo"
        message="Se eliminará permanentemente este trabajo de transcripción. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setJobToDelete(null)}
      />
    </div>
  );
}
