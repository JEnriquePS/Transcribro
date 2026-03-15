import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { FileUploader } from "../components/FileUploader";
import {
  TranscriptionConfig,
  type TranscriptionConfigValues,
} from "../components/TranscriptionConfig";
import { getModels, transcribeBatch, transcribeSingle } from "../../infrastructure/api/client";
import type { ModelInfo } from "../../domain/types";

export function UploadPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [config, setConfig] = useState<TranscriptionConfigValues>({
    model: "large-v3",
    language: "es",
    outputFormats: ["txt", "json", "srt", "vtt"],
  });
  const [models, setModels] = useState<readonly ModelInfo[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getModels()
      .then((data) => {
        setModels(data.models);
        setConfig((prev) => ({ ...prev, model: data.default }));
      })
      .catch(() => {
        // Models endpoint may not be available yet; non-critical
      });
  }, []);

  const handleFilesSelected = useCallback((selected: File[]) => {
    setFiles(selected);
    setError(null);
  }, []);

  const handleConfigChange = useCallback((next: TranscriptionConfigValues) => {
    setConfig(next);
  }, []);

  const handleSubmit = async () => {
    if (files.length === 0) return;

    setSubmitting(true);
    setError(null);

    try {
      const apiConfig = {
        model: config.model,
        language: config.language,
      };

      if (files.length === 1) {
        const job = await transcribeSingle(files[0]!, apiConfig);
        navigate(`/jobs/${job.job_id}`);
      } else {
        await transcribeBatch(files, apiConfig);
        navigate("/jobs");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start transcription";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
          <Upload size={20} className="text-accent-text" />
          Upload Video
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Select video files to transcribe
        </p>
      </div>

      <div className="space-y-6 bg-surface border border-border-default rounded-lg p-6">
        <FileUploader onFilesSelected={handleFilesSelected} />

        <hr className="border-border-default" />

        <TranscriptionConfig
          config={config}
          onConfigChange={handleConfigChange}
          availableModels={models}
        />
      </div>

      {error && (
        <p className="text-sm text-error bg-error-muted border border-error rounded px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={files.length === 0 || submitting}
        onClick={handleSubmit}
        className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-text-inverse font-medium rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        {submitting ? (
          <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
        ) : (
          <Sparkles size={16} />
        )}
        {submitting ? "Uploading..." : "Transcribe"}
      </button>
    </div>
  );
}
