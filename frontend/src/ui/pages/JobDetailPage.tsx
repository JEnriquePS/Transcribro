import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileVideo,
  AlertCircle,
  Loader2,
  RefreshCw,
  Play,
  Cpu,
  Languages,
} from "lucide-react";
import { useJobPolling } from "../../application/hooks/useJobPolling";
import { ProgressBar } from "../components/ProgressBar";
import { TranscriptViewer } from "../components/TranscriptViewer";
import { LiveTranscript } from "../components/LiveTranscript";
import { retryJob } from "../../infrastructure/api/client";
import { JobStatus } from "../../domain/types";
import { useState } from "react";

function formatOffsetLabel(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { metadata, result, isLoading, error } = useJobPolling(
    id ?? "",
    !!id,
  );
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async (resume: boolean) => {
    if (!id) return;
    setRetrying(true);
    try {
      await retryJob(id, resume);
    } catch {
      // Error will be reflected on next poll
    } finally {
      setRetrying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !metadata) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => navigate("/jobs")}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to jobs
        </button>
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
          {error ?? "Job not found"}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        type="button"
        onClick={() => navigate("/jobs")}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to jobs
      </button>

      {/* Header */}
      <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileVideo size={18} className="text-cyan-400" />
          <h1 className="text-lg font-semibold text-gray-100">
            {metadata.original_filename}
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="flex items-center gap-1 text-gray-500">
              <Cpu size={12} />
              Model
            </span>
            <p className="text-gray-200">{metadata.config.model}</p>
          </div>
          <div>
            <span className="flex items-center gap-1 text-gray-500">
              <Languages size={12} />
              Language
            </span>
            <p className="text-gray-200">{metadata.config.language}</p>
          </div>
        </div>

        <ProgressBar metadata={metadata} />

        <p className="text-[10px] text-gray-600 font-mono">{metadata.job_id}</p>
      </div>

      {/* Live Transcript during transcription */}
      {metadata.status === JobStatus.TRANSCRIBING && (
        <LiveTranscript jobId={metadata.job_id} isActive />
      )}

      {/* Partial transcript after failure */}
      {metadata.status === JobStatus.FAILED && (
        <LiveTranscript jobId={metadata.job_id} isActive={false} />
      )}

      {/* Failed State */}
      {metadata.status === JobStatus.FAILED && (
        <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-2 text-red-400">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Transcription failed</p>
              {metadata.error && (
                <p className="text-xs mt-1 opacity-80">{metadata.error}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {metadata.last_offset_ms != null && metadata.last_offset_ms > 0 && (
              <button
                type="button"
                onClick={() => handleRetry(true)}
                disabled={retrying}
                className="flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 transition-colors disabled:opacity-50"
              >
                {retrying ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Play size={12} />
                )}
                Resume from {formatOffsetLabel(metadata.last_offset_ms)}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleRetry(false)}
              disabled={retrying}
              className="flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 transition-colors disabled:opacity-50"
            >
              {retrying ? (
                <Loader2 size={12} className="animate-spin" />
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
        <TranscriptViewer jobId={metadata.job_id} result={result} />
      )}
    </div>
  );
}
