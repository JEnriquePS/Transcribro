import { useEffect, useRef, useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { getPartialTranscript, type PartialTranscript } from "../../infrastructure/api/client";

const POLL_INTERVAL = 2000;

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface LiveTranscriptProps {
  readonly jobId: string;
  readonly isActive: boolean;
}

export function LiveTranscript({ jobId, isActive }: LiveTranscriptProps) {
  const [data, setData] = useState<PartialTranscript>({ segments: [], text: "" });
  const [copied, setCopied] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchTranscript = useCallback(async () => {
    try {
      const result = await getPartialTranscript(jobId);
      setData(result);
      setHasLoaded(true);
    } catch {
      // Silently ignore fetch errors during polling
    }
  }, [jobId]);

  useEffect(() => {
    fetchTranscript();

    if (!isActive) return;

    const interval = setInterval(fetchTranscript, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTranscript, isActive]);

  // Auto-scroll to bottom when segments update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data.segments.length]);

  const handleCopy = async () => {
    if (!data.text) return;
    await navigator.clipboard.writeText(data.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Don't render if loaded with no text and not actively polling
  if (hasLoaded && data.segments.length === 0 && !isActive) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
          )}
          <span className="text-xs text-gray-400 font-medium">
            {isActive ? "Live transcript" : "Partial transcript"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!data.text}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Copy transcript"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>

      <div
        ref={scrollRef}
        className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 max-h-64 overflow-y-auto"
      >
        {data.segments.length > 0 ? (
          <div className="space-y-1">
            {data.segments.map((segment, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="font-mono text-cyan-500 text-xs shrink-0 pt-0.5">
                  [{formatTimestamp(segment.start)}]
                </span>
                <span className="text-gray-200">{segment.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-600 italic">
            {isActive ? "Waiting for transcript..." : "No transcript available"}
          </p>
        )}
      </div>
    </div>
  );
}
