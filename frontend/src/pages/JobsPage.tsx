import { useNavigate } from "react-router-dom";
import { Inbox, Loader2, ListVideo } from "lucide-react";
import { JobCard } from "../components/JobCard";
import { useJobsPolling } from "../hooks/useJobPolling";
import { deleteJob } from "../api/client";
import { useState } from "react";

export function JobsPage() {
  const navigate = useNavigate();
  const { jobs, isLoading, error } = useJobsPolling(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (jobId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(jobId);
    try {
      await deleteJob(jobId);
    } catch {
      // Deletion error will be reflected on next poll
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-100">
        <ListVideo size={22} className="text-cyan-400" />
        Jobs
      </h1>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Inbox size={40} className="mb-3" />
          <p className="text-sm">No transcription jobs yet</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
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
    </div>
  );
}
