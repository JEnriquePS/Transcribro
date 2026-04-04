/**
 * Error codes shared between main process and renderer.
 * Used to communicate structured errors across the IPC boundary.
 */
export enum ErrorCode {
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  INVALID_JOB_STATE = 'INVALID_JOB_STATE',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  FILE_SIZE_EXCEEDED = 'FILE_SIZE_EXCEEDED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TRANSCRIPTION_FAILED = 'TRANSCRIPTION_FAILED',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/** Structured error response carried across the IPC boundary. */
export interface IpcError {
  readonly code: ErrorCode
  readonly message: string
}
