import { useNavigate } from "react-router-dom";
import { Inbox, Loader2, ListVideo } from "lucide-react";
import { JobCard } from "../components/JobCard";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useJobsPolling } from "../../application/hooks/useJobPolling";
import { deleteJob } from "../../infrastructure/api/client";
import { useState } from "react";

export function JobsPage() {
  const navigate = useNavigate();
  const { jobs, isLoading, error } = useJobsPolling(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);

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
      // Deletion error will be reflected on next poll
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin motion-reduce:animate-none text-text-secondary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-sm text-error bg-error-muted border border-error rounded px-3 py-2">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
        <ListVideo size={22} className="text-accent-text" />
        Jobs
      </h1>

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
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard
              key={job.job_id}
              job={job}
              onClick={() => navigate(`/jobs/${job.job_id}`)}
              onDelete={(e) => handleDelete(job.job_id, e)}
              isDeleting={deleting === job.job_id}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={jobToDelete !== null}
        title="Eliminar trabajo"
        message="Se eliminar\u00e1 permanentemente este trabajo de transcripci\u00f3n. Esta acci\u00f3n no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setJobToDelete(null)}
      />
    </div>
  );
}
