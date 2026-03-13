import { useCallback, useRef, useState } from "react";
import { Upload, X, FileVideo } from "lucide-react";

export const ALLOWED_EXTENSIONS = new Set([
  // Video
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".webm",
  // Audio
  ".mp3",
  ".wav",
  ".flac",
  ".ogg",
  ".m4a",
]);

export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

export function isValidFile(file: File): boolean {
  return ALLOWED_EXTENSIONS.has(getExtension(file.name));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

interface FileUploaderProps {
  readonly onFilesSelected: (files: File[]) => void;
}

export function FileUploader({ onFilesSelected }: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<readonly File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const files = Array.from(incoming);
      const invalid = files.filter((f) => !isValidFile(f));

      if (invalid.length > 0) {
        setError(
          `Invalid file type: ${invalid.map((f) => f.name).join(", ")}. Accepted: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
        );
        return;
      }

      setError(null);
      const next = [...selectedFiles, ...files];
      setSelectedFiles(next);
      onFilesSelected(next);
    },
    [selectedFiles, onFilesSelected],
  );

  const removeFile = useCallback(
    (index: number) => {
      const next = selectedFiles.filter((_, i) => i !== index);
      setSelectedFiles(next);
      onFilesSelected(next);
    },
    [selectedFiles, onFilesSelected],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!dragOver) setDragOver(true);
    },
    [dragOver],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
    },
    [addFiles],
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`w-full border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-cyan-400 bg-cyan-400/10"
            : "border-gray-700 hover:border-gray-500 bg-gray-900/50"
        }`}
      >
        <Upload
          className={`mx-auto mb-3 ${dragOver ? "text-cyan-400" : "text-gray-500"}`}
          size={32}
        />
        <p className="text-sm text-gray-300">
          Drag & drop video files here, or click to browse
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Supported: {[...ALLOWED_EXTENSIONS].join(", ")}
        </p>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={[...ALLOWED_EXTENSIONS].join(",")}
        onChange={handleInputChange}
        className="hidden"
      />

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
          {error}
        </p>
      )}

      {selectedFiles.length > 0 && (
        <ul className="space-y-1">
          {selectedFiles.map((file, i) => (
            <li
              key={`${file.name}-${file.size}-${i}`}
              className="flex items-center justify-between bg-gray-800/50 border border-gray-700/50 rounded px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileVideo size={16} className="text-cyan-400 shrink-0" />
                <span className="text-sm text-gray-200 truncate">
                  {file.name}
                </span>
                <span className="text-xs text-gray-500 shrink-0">
                  {formatFileSize(file.size)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-gray-500 hover:text-red-400 transition-colors ml-2 shrink-0"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
