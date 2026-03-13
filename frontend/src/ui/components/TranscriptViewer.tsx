import { useState, useEffect, useCallback } from "react";
import { List, Copy, Check, Download, Loader2, FileText, Braces, Captions, Globe } from "lucide-react";
import { downloadFile, previewFile } from "../../infrastructure/api/client";
import type { TranscriptResult } from "../../domain/types";

type Tab = "segments" | "txt" | "json" | "srt" | "vtt";

const TAB_ICONS: Record<Tab, React.ComponentType<{ size?: number }>> = {
  segments: List,
  txt: FileText,
  json: Braces,
  srt: Captions,
  vtt: Globe,
};

const FORMAT_TABS: readonly { key: Tab; label: string }[] = [
  { key: "segments", label: "Segments" },
  { key: "txt", label: "TXT" },
  { key: "json", label: "JSON" },
  { key: "srt", label: "SRT" },
  { key: "vtt", label: "VTT" },
];

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface TranscriptViewerProps {
  readonly jobId: string;
  readonly result: TranscriptResult;
}

export function TranscriptViewer({ jobId, result }: TranscriptViewerProps) {
  const [tab, setTab] = useState<Tab>("segments");
  const [previews, setPreviews] = useState<Partial<Record<Tab, string>>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchPreview = useCallback(async (format: Tab) => {
    if (format === "segments" || previews[format] != null) return;
    setLoadingPreview(true);
    try {
      const content = await previewFile(jobId, format);
      setPreviews((prev) => ({ ...prev, [format]: content }));
    } catch {
      setPreviews((prev) => ({ ...prev, [format]: "Failed to load preview" }));
    } finally {
      setLoadingPreview(false);
    }
  }, [jobId, previews]);

  useEffect(() => {
    fetchPreview(tab);
  }, [tab, fetchPreview]);

  const currentContent = tab === "segments"
    ? result.full_text
    : (previews[tab] ?? "");

  const handleCopy = async () => {
    const text = tab === "segments"
      ? result.segments.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`).join("\n")
      : currentContent;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    const format = tab === "segments" ? "txt" : tab;
    setDownloading(true);
    try {
      const blob = await downloadFile(jobId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transcript.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Browser handles download errors
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Tabs + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-0.5 bg-gray-800 rounded p-0.5 overflow-x-auto">
          {FORMAT_TABS.map(({ key, label }) => {
            const Icon = TAB_ICONS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${
                  tab === key
                    ? "bg-gray-700 text-cyan-400"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!currentContent && tab !== "segments"}
            className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-30"
            title="Copy"
          >
            {copied ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
            title={`Download ${tab === "segments" ? "TXT" : tab.toUpperCase()}`}
          >
            {downloading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto">
        {tab === "segments" ? (
          <div className="space-y-1">
            {result.segments.map((segment, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="font-mono text-cyan-500 text-xs shrink-0 pt-0.5">
                  [{formatTimestamp(segment.start)}]
                </span>
                <span className="text-gray-200">{segment.text}</span>
              </div>
            ))}
          </div>
        ) : loadingPreview && previews[tab] == null ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gray-500" />
          </div>
        ) : (
          <pre className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed font-mono">
            {previews[tab] ?? ""}
          </pre>
        )}
      </div>
    </div>
  );
}
