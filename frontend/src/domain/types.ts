export enum JobStatus {
  PENDING = "pending",
  EXTRACTING = "extracting",
  TRANSCRIBING = "transcribing",
  FORMATTING = "formatting",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface TranscriptionConfig {
  readonly model: string;
  readonly language: string;
  readonly threads?: number;
}

export interface JobMetadata {
  readonly job_id: string;
  readonly original_filename: string;
  readonly display_name: string | null;
  readonly status: JobStatus;
  readonly config: TranscriptionConfig;
  readonly error: string | null;
  readonly progress: number;
  readonly extraction_progress: number;
  readonly transcription_progress: number;
  readonly formatting_progress: number;
  readonly last_offset_ms: number | null;
  readonly created_at: string | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly duration_seconds: number | null;
}

export interface TranscriptSegment {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export interface TranscriptResult {
  readonly job_id: string;
  readonly original_filename: string;
  readonly model: string;
  readonly language: string;
  readonly segments: readonly TranscriptSegment[];
  readonly full_text: string;
}

export interface ModelInfo {
  readonly name: string;
  readonly size_mb: number;
  readonly available: boolean;
}

export interface JobDetail {
  readonly metadata: JobMetadata;
  readonly result: TranscriptResult | null;
}
