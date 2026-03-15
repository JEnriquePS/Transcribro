import { AlertTriangle, Languages, Cpu, FileOutput } from "lucide-react";
import type { ModelInfo } from "../../domain/types";

export type OutputFormat = "txt" | "json" | "srt" | "vtt";

export interface TranscriptionConfigValues {
  readonly model: string;
  readonly language: string;
  readonly outputFormats: readonly OutputFormat[];
}

const LANGUAGES = [
  { value: "es", label: "Espanol" },
  { value: "en", label: "English" },
  { value: "auto", label: "Auto-detect" },
] as const;

const MODEL_OPTIONS = [
  { value: "tiny", label: "Tiny", size: "~75 MB" },
  { value: "base", label: "Base", size: "~142 MB" },
  { value: "small", label: "Small", size: "~466 MB" },
  { value: "medium", label: "Medium", size: "~1.5 GB" },
  { value: "large-v3", label: "Large v3", size: "~2.9 GB" },
] as const;

const ALL_FORMATS: readonly OutputFormat[] = ["txt", "json", "srt", "vtt"];

interface TranscriptionConfigProps {
  readonly config: TranscriptionConfigValues;
  readonly onConfigChange: (config: TranscriptionConfigValues) => void;
  readonly availableModels: readonly ModelInfo[];
}

export function TranscriptionConfig({
  config,
  onConfigChange,
  availableModels,
}: TranscriptionConfigProps) {
  const availableModelNames = new Set(
    availableModels.filter((m) => m.available).map((m) => m.name),
  );

  const handleLanguageChange = (language: string) => {
    onConfigChange({ ...config, language });
  };

  const handleModelChange = (model: string) => {
    onConfigChange({ ...config, model });
  };

  const handleFormatToggle = (format: OutputFormat) => {
    const current = config.outputFormats;
    const next = current.includes(format)
      ? current.filter((f) => f !== format)
      : [...current, format];
    if (next.length > 0) {
      onConfigChange({ ...config, outputFormats: next });
    }
  };

  return (
    <div className="space-y-5">
      {/* Language Selection */}
      <fieldset>
        <legend className="flex items-center gap-1.5 text-sm font-medium text-text-secondary mb-2">
          <Languages size={14} className="text-text-secondary" />
          Language
        </legend>
        <div className="flex gap-4">
          {LANGUAGES.map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                name="language"
                value={value}
                checked={config.language === value}
                onChange={() => handleLanguageChange(value)}
                className="accent-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              />
              <span className="text-sm text-text-primary">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Model Selection */}
      <div>
        <label
          htmlFor="model-select"
          className="flex items-center gap-1.5 text-sm font-medium text-text-secondary mb-2"
        >
          <Cpu size={14} className="text-text-secondary" />
          Model
        </label>
        <div className="relative">
          <select
            id="model-select"
            value={config.model}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full bg-surface-elevated border border-border-default rounded px-3 py-2 text-sm text-text-primary appearance-none cursor-pointer focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {MODEL_OPTIONS.map(({ value, label, size }) => (
              <option key={value} value={value}>
                {label} ({size})
              </option>
            ))}
          </select>
        </div>
        {availableModels.length > 0 &&
          !availableModelNames.has(config.model) && (
            <p className="flex items-center gap-1.5 mt-1.5 text-xs text-warning">
              <AlertTriangle size={14} />
              Model not downloaded. Transcription will fail until it is
              available.
            </p>
          )}
      </div>

      {/* Output Formats */}
      <fieldset>
        <legend className="flex items-center gap-1.5 text-sm font-medium text-text-secondary mb-2">
          <FileOutput size={14} className="text-text-secondary" />
          Output Formats
        </legend>
        <div className="flex gap-4">
          {ALL_FORMATS.map((format) => (
            <label
              key={format}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={config.outputFormats.includes(format)}
                onChange={() => handleFormatToggle(format)}
                className="accent-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              />
              <span className="text-sm text-text-primary uppercase">{format}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
