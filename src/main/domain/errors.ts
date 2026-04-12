import { ErrorCode } from '../../shared/errors'

/**
 * Base class for all domain errors.
 * Carries a typed error code for structured IPC error responses.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class JobNotFoundError extends DomainError {
  constructor(public readonly jobId: string) {
    super(ErrorCode.JOB_NOT_FOUND, `Job not found: ${jobId}`)
  }
}

export class FolderNotFoundError extends DomainError {
  constructor(public readonly folderId: string) {
    super(ErrorCode.FOLDER_NOT_FOUND, `Folder not found: ${folderId}`)
  }
}

export class InvalidJobStateError extends DomainError {
  constructor(
    public readonly jobId: string,
    currentState: string,
    expectedStates: string[],
  ) {
    super(
      ErrorCode.INVALID_JOB_STATE,
      `Job ${jobId} is in state ${currentState}, expected one of ${expectedStates.join(', ')}`,
    )
  }
}

export class ModelNotFoundError extends DomainError {
  constructor(public readonly modelName: string) {
    super(ErrorCode.MODEL_NOT_FOUND, `Model not available: ${modelName}`)
  }
}

export class UnsupportedFormatError extends DomainError {
  constructor(public readonly format: string) {
    super(ErrorCode.UNSUPPORTED_FORMAT, `Unsupported format: ${format}`)
  }
}

export class FileSizeExceededError extends DomainError {
  constructor(
    public readonly size: number,
    public readonly maxSize: number,
  ) {
    super(
      ErrorCode.FILE_SIZE_EXCEEDED,
      `File size ${size} exceeds maximum ${maxSize}`,
    )
  }
}

export class TranscriptionFailedError extends DomainError {
  constructor(reason: string) {
    super(ErrorCode.TRANSCRIPTION_FAILED, reason)
  }
}

export class ExtractionFailedError extends DomainError {
  constructor(reason: string) {
    super(ErrorCode.EXTRACTION_FAILED, reason)
  }
}
