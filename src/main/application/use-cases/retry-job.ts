import type { JobMetadata } from '../../../shared/types'
import { JobStatus } from '../../../shared/types'
import { InvalidJobStateError, JobNotFoundError } from '../../domain/errors'
import type { DrizzleJobRepository } from '../../infrastructure/repositories/drizzle-job-repository'

export class RetryJobUseCase {
  constructor(private readonly repo: DrizzleJobRepository) {}

  execute(jobId: string, resume = false): JobMetadata {
    const current = this.repo.get(jobId)
    if (current === null) throw new JobNotFoundError(jobId)

    if (current.status !== JobStatus.FAILED) {
      throw new InvalidJobStateError(jobId, current.status, [JobStatus.FAILED])
    }

    if (resume && current.lastOffsetMs !== null) {
      // Keep extracted audio; resume transcription from last offset
      return this.repo.update(jobId, {
        status: JobStatus.PENDING,
        error: null,
        progress: 0.2,
        extractionProgress: 1.0,
        transcriptionProgress: 0,
        formattingProgress: 0,
        startedAt: null,
        completedAt: null,
        durationSeconds: null,
      })
    }

    // Full retry from scratch
    return this.repo.update(jobId, {
      status: JobStatus.PENDING,
      progress: 0,
      error: null,
      extractionProgress: 0,
      transcriptionProgress: 0,
      formattingProgress: 0,
      startedAt: null,
      completedAt: null,
      durationSeconds: null,
      lastOffsetMs: null,
    })
  }
}
