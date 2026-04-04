import path from 'node:path'
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from '../../shared/constants'
import { JOB_ID_REGEX } from '../../shared/constants'
import { UnsupportedFormatError, FileSizeExceededError } from './errors'

/**
 * Validate that a job ID matches the expected 32-char lowercase hex format.
 * Throws ValueError variant (plain Error) for internal use; IPC layer uses Zod schemas.
 */
export function validateJobId(jobId: string): string {
  if (!JOB_ID_REGEX.test(jobId)) {
    throw new Error(`Invalid job ID format: ${JSON.stringify(jobId)}`)
  }
  return jobId
}

/**
 * Validate that a file extension is supported.
 * Throws UnsupportedFormatError if not.
 */
export function validateFileExtension(filePath: string): void {
  const ext = path.extname(filePath).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new UnsupportedFormatError(ext || '(no extension)')
  }
}

/**
 * Validate that a file size does not exceed the maximum.
 * Throws FileSizeExceededError if it does.
 */
export function validateFileSize(sizeBytes: number): void {
  if (sizeBytes > MAX_FILE_SIZE) {
    throw new FileSizeExceededError(sizeBytes, MAX_FILE_SIZE)
  }
}
