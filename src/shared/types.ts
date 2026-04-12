/**
 * Domain types shared between main process and renderer.
 * All types are readonly (equivalent to Python's frozen=True).
 * camelCase convention — snake_case is only used at the Python API boundary.
 */

export interface Folder {
  readonly id: string
  readonly name: string
  readonly parentId: string | null
  readonly createdAt: string | null
}

export enum JobStatus {
  PENDING = 'pending',
  EXTRACTING = 'extracting',
  TRANSCRIBING = 'transcribing',
  FORMATTING = 'formatting',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface TranscriptionConfig {
  readonly model: string
  readonly language: string
  readonly threads?: number
}

export interface JobMetadata {
  readonly id: string
  readonly originalFilename: string
  readonly displayName: string | null
  readonly status: JobStatus
  readonly config: TranscriptionConfig
  readonly error: string | null
  readonly progress: number
  readonly extractionProgress: number
  readonly transcriptionProgress: number
  readonly formattingProgress: number
  /** Last successfully transcribed offset in milliseconds (used for resume). */
  readonly lastOffsetMs: number | null
  readonly createdAt: string | null
  readonly startedAt: string | null
  readonly completedAt: string | null
  readonly durationSeconds: number | null
  readonly folderId: string | null
}

export interface TranscriptSegment {
  readonly start: number
  readonly end: number
  readonly text: string
}

export interface TranscriptResult {
  readonly jobId: string
  readonly originalFilename: string
  readonly model: string
  readonly language: string
  readonly segments: readonly TranscriptSegment[]
  readonly fullText: string
}

export interface ModelInfo {
  readonly name: string
  readonly sizeMb: number
  readonly available: boolean
}

export interface JobDetail {
  readonly metadata: JobMetadata
  readonly result: TranscriptResult | null
}

/** Push event sent from main → renderer when a job's progress changes. */
export interface JobProgressEvent {
  readonly jobId: string
  readonly status: JobStatus
  readonly progress: number
  readonly extractionProgress: number
  readonly transcriptionProgress: number
  readonly formattingProgress: number
  readonly lastOffsetMs: number | null
}

/** Push event sent from main → renderer when a job completes. */
export interface JobCompletedEvent {
  readonly jobId: string
  readonly metadata: JobMetadata
}

/** Push event sent from main → renderer when a job fails. */
export interface JobFailedEvent {
  readonly jobId: string
  readonly error: string
}

