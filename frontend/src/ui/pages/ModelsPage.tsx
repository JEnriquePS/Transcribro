import { useCallback, useEffect, useState } from "react";
import {
  HardDrive,
  Download,
  Trash2,
  Loader2,
  CheckCircle2,
  Circle,
  X,
  Star,
} from "lucide-react";
import {
  getModels,
  getModelStatus,
  downloadModel,
  cancelDownload,
  deleteModel,
  setDefaultModel as apiSetDefaultModel,
  type ModelDownloadStatus,
} from "../../infrastructure/api/client";
import type { ModelInfo } from "../../domain/types";

interface ModelState {
  readonly info: ModelInfo;
  readonly downloadStatus: ModelDownloadStatus | null;
  readonly action: "idle" | "downloading" | "deleting";
}

function formatSize(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

export function ModelsPage() {
  const [models, setModels] = useState<readonly ModelState[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    try {
      const data = await getModels();
      setDefaultModel(data.default);

      const states: ModelState[] = data.models.map((info) => ({
        info,
        downloadStatus: null,
        action: "idle",
      }));
      setModels(states);

      // Fetch download status for each model
      const statuses = await Promise.all(
        data.models.map((m) => getModelStatus(m.name).catch(() => null)),
      );
      setModels(
        states.map((s, i) => ({ ...s, downloadStatus: statuses[i] })),
      );
    } catch {
      setError("Failed to load models");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Poll downloading models
  useEffect(() => {
    const downloading = models.some((m) => m.action === "downloading");
    if (!downloading) return;

    const interval = setInterval(async () => {
      const updated = await Promise.all(
        models.map(async (m) => {
          if (m.action !== "downloading") return m;
          try {
            const status = await getModelStatus(m.info.name);
            if (status.status === "ready") {
              return {
                ...m,
                info: { ...m.info, available: true },
                downloadStatus: status,
                action: "idle" as const,
              };
            }
            if (status.status === "failed" || status.status === "not_downloaded") {
              return { ...m, downloadStatus: status, action: "idle" as const };
            }
            return { ...m, downloadStatus: status };
          } catch {
            return m;
          }
        }),
      );
      setModels(updated);
    }, 2000);

    return () => clearInterval(interval);
  }, [models]);

  const handleDownload = async (name: string) => {
    setModels((prev) =>
      prev.map((m) => (m.info.name === name ? { ...m, action: "downloading" } : m)),
    );
    try {
      await downloadModel(name);
    } catch {
      setModels((prev) =>
        prev.map((m) => (m.info.name === name ? { ...m, action: "idle" } : m)),
      );
    }
  };

  const handleCancelDownload = async (name: string) => {
    try {
      await cancelDownload(name);
      setModels((prev) =>
        prev.map((m) =>
          m.info.name === name
            ? { ...m, downloadStatus: { status: "not_downloaded" }, action: "idle" }
            : m,
        ),
      );
    } catch {
      // Ignore — polling will update status
    }
  };

  const handleSetDefault = async (name: string) => {
    try {
      await apiSetDefaultModel(name);
      setDefaultModel(name);
    } catch {
      // Ignore
    }
  };

  const handleDelete = async (name: string) => {
    setModels((prev) =>
      prev.map((m) => (m.info.name === name ? { ...m, action: "deleting" } : m)),
    );
    try {
      await deleteModel(name);
      setModels((prev) =>
        prev.map((m) =>
          m.info.name === name
            ? {
                ...m,
                info: { ...m.info, available: false },
                downloadStatus: { status: "not_downloaded" },
                action: "idle",
              }
            : m,
        ),
      );
    } catch {
      setModels((prev) =>
        prev.map((m) => (m.info.name === name ? { ...m, action: "idle" } : m)),
      );
    }
  };

  if (loading) {
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
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-100">
          <HardDrive size={22} className="text-cyan-400" />
          Models
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage whisper.cpp models
        </p>
      </div>

      <div className="space-y-2">
        {models.map((model) => {
          const isDefault = model.info.name === defaultModel;
          const isReady = model.info.available;
          const isDownloading = model.action === "downloading";
          const isDeleting = model.action === "deleting";
          const progressMb = model.downloadStatus?.progress_mb;

          return (
            <div
              key={model.info.name}
              className="flex items-center justify-between bg-gray-900/50 border border-gray-800 rounded-lg px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                {isReady ? (
                  <CheckCircle2 size={18} className="text-green-400 shrink-0" />
                ) : isDownloading ? (
                  <Loader2 size={18} className="animate-spin text-cyan-400 shrink-0" />
                ) : (
                  <Circle size={18} className="text-gray-600 shrink-0" />
                )}

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">
                      {model.info.name}
                    </span>
                    {isDefault && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
                        <Star size={10} />
                        default
                      </span>
                    )}
                  </div>
                  {isDownloading && progressMb != null ? (
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 bg-gray-800 rounded-full h-2 min-w-[120px]">
                        <div
                          className="h-2 rounded-full bg-cyan-400 transition-all duration-500"
                          style={{ width: `${Math.min(Math.round((progressMb / model.info.size_mb) * 100), 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap font-mono">
                        {formatSize(progressMb)} / {formatSize(model.info.size_mb)}
                        <span className="text-cyan-400 ml-2">
                          {Math.min(Math.round((progressMb / model.info.size_mb) * 100), 100)}%
                        </span>
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">
                      {formatSize(model.info.size_mb)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-3">
                {isReady ? (
                  <>
                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(model.info.name)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-gray-700 text-gray-400 hover:text-amber-400 hover:border-amber-400/50 transition-colors"
                        title="Set as default model"
                      >
                        <Star size={13} />
                        Set default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(model.info.name)}
                      disabled={isDeleting || isDefault}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-400/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={isDefault ? "Cannot delete default model" : "Delete model"}
                    >
                      {isDeleting ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                      Delete
                    </button>
                  </>
                ) : isDownloading ? (
                  <button
                    type="button"
                    onClick={() => handleCancelDownload(model.info.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-400/50 transition-colors"
                    title="Cancel download"
                  >
                    <X size={13} />
                    Cancel
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDownload(model.info.name)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-gray-700 text-gray-400 hover:text-cyan-400 hover:border-cyan-400/50 transition-colors"
                  >
                    <Download size={13} />
                    Download
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
