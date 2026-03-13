import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Upload } from "lucide-react";
import { FileUploader } from "../components/FileUploader";
import {
  TranscriptionConfig,
  type TranscriptionConfigValues,
} from "../components/TranscriptionConfig";
import { getModels, transcribeBatch, transcribeSingle } from "../api/client";
import type { ModelInfo } from "../types";

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
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-100">
          <Upload size={20} className="text-cyan-400" />
          Upload Video
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Select video files to transcribe
        </p>
      </div>

      <div className="space-y-6 bg-gray-900/30 border border-gray-800 rounded-lg p-6">
        <FileUploader onFilesSelected={handleFilesSelected} />

        <hr className="border-gray-800" />

        <TranscriptionConfig
          config={config}
          onConfigChange={handleConfigChange}
          availableModels={models}
        />
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={files.length === 0 || submitting}
        onClick={handleSubmit}
        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-medium rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Sparkles size={16} />
        )}
        {submitting ? "Uploading..." : "Transcribe"}
      </button>
    </div>
  );
}
