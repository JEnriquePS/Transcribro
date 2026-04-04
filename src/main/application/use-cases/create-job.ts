import { randomBytes } from 'node:crypto'
import path from 'node:path'
import type { JobMetadata, TranscriptionConfig } from '../../../shared/types'
import { JobStatus } from '../../../shared/types'
import type { DrizzleJobRepository } from '../../infrastructure/repositories/drizzle-job-repository'

function nowIso(): string {
  return new Date().toISOString()
}

export class CreateJobUseCase {
  constructor(private readonly repo: DrizzleJobRepository) {}

  execute(filePath: string, config: TranscriptionConfig): JobMetadata {
    const jobId = randomBytes(16).toString('hex')
    const originalFilename = path.basename(filePath)

    const metadata: JobMetadata = {
      id: jobId,
      originalFilename,
      displayName: null,
      status: JobStatus.PENDING,
      config,
      error: null,
      progress: 0,
      extractionProgress: 0,
      transcriptionProgress: 0,
      formattingProgress: 0,
      lastOffsetMs: null,
      createdAt: nowIso(),
      startedAt: null,
      completedAt: null,
      durationSeconds: null,
    }

    this.repo.save(metadata)
    this.repo.copyInputFile(jobId, filePath)
    return metadata
  }
}
