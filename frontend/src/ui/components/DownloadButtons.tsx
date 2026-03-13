import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { downloadFile } from "../../infrastructure/api/client";

interface DownloadButtonsProps {
  readonly jobId: string;
  readonly formats: readonly string[];
}

export function DownloadButtons({ jobId, formats }: DownloadButtonsProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (format: string) => {
    setDownloading(format);
    try {
      const blob = await downloadFile(jobId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${jobId}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Download errors are visible via the browser's default behavior
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {formats.map((format) => (
        <button
          key={format}
          type="button"
          disabled={downloading !== null}
          onClick={() => handleDownload(format)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 hover:border-cyan-400 hover:text-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloading === format ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          <span className="uppercase">{format}</span>
        </button>
      ))}
    </div>
  );
}
