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
        <div className="flex gap-0.5 bg-surface-elevated rounded p-0.5 overflow-x-auto">
          {FORMAT_TABS.map(({ key, label }) => {
            const Icon = TAB_ICONS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                  tab === key
                    ? "bg-border-default text-accent-text"
                    : "text-text-secondary hover:text-text-primary"
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
            aria-label="Copiar transcripción"
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-30 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
            title="Copy"
          >
            {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-label="Descargar transcripción"
            className="p-1.5 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
            title={`Download ${tab === "segments" ? "TXT" : tab.toUpperCase()}`}
          >
            {downloading ? (
              <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Download size={15} />
            )}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="bg-surface border border-border-default rounded-lg p-4 max-h-96 overflow-y-auto">
        {tab === "segments" ? (
          <div className="space-y-1">
            {result.segments.map((segment, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="font-mono text-accent-text text-xs shrink-0 pt-0.5">
                  [{formatTimestamp(segment.start)}]
                </span>
                <span className="text-text-primary">{segment.text}</span>
              </div>
            ))}
          </div>
        ) : loadingPreview && previews[tab] == null ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin motion-reduce:animate-none text-text-secondary" />
          </div>
        ) : (
          <pre className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed font-mono">
            {previews[tab] ?? ""}
          </pre>
        )}
      </div>
    </div>
  );
}
