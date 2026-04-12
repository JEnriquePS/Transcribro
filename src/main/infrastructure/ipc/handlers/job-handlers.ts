import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { IPC } from '../../../../shared/ipc-channels'
import {
  createJobInputSchema,
  createBatchInputSchema,
  listJobsInputSchema,
  jobGetInputSchema,
  jobDeleteInputSchema,
  renameJobInputSchema,
  retryJobInputSchema,
  downloadInputSchema,
  moveJobToFolderInputSchema,
  jobIdSchema,
} from '../../../../shared/schemas'
import { JobStatus } from '../../../../shared/types'
import { JobNotFoundError } from '../../../domain/errors'
import { handleIpc } from '../ipc-wrapper'
import type { DrizzleJobRepository } from '../../repositories/drizzle-job-repository'
import type { DrizzleFolderRepository } from '../../repositories/drizzle-folder-repository'
import type { CreateJobUseCase } from '../../../application/use-cases/create-job'
import type { RetryJobUseCase } from '../../../application/use-cases/retry-job'
import type { JobQueue } from '../../../application/job-queue'

export function registerJobHandlers(
  repo: DrizzleJobRepository,
  folderRepo: DrizzleFolderRepository,
  createJobUc: CreateJobUseCase,
  retryJobUc: RetryJobUseCase,
  queue: JobQueue,
): void {
  // Create single job from local file path
  handleIpc(IPC.JOBS_CREATE, createJobInputSchema, (input) => {
    const metadata = createJobUc.execute(input.filePath, input.config)
    queue.enqueue(metadata.id)
    return metadata
  })

  // Create batch of jobs from local file paths
  handleIpc(IPC.JOBS_CREATE_BATCH, createBatchInputSchema, (input) => {
    return input.filePaths.map((filePath) => {
      const metadata = createJobUc.execute(filePath, input.config)
      queue.enqueue(metadata.id)
      return metadata
    })
  })

  // List jobs with optional folder filter (recursive: includes descendants)
  handleIpc(IPC.JOBS_LIST, listJobsInputSchema, (input) => {
    if (input.folderId === '__uncategorized__') {
      return repo.list(input.limit, input.offset, null)
    } else if (input.folderId) {
      const ids = folderRepo.getAllDescendantIds(input.folderId)
      return repo.list(input.limit, input.offset, ids)
    }
    return repo.list(input.limit, input.offset, undefined)
  })

  // Move job to a folder (or remove from folder when folderId is null)
  handleIpc(IPC.JOBS_MOVE_TO_FOLDER, moveJobToFolderInputSchema, (input) => {
    return repo.moveToFolder(input.jobId, input.folderId)
  })

  // Get single job + transcript result (if completed)
  handleIpc(IPC.JOBS_GET, jobGetInputSchema, (input) => {
    const metadata = repo.get(input.jobId)
    if (!metadata) throw new JobNotFoundError(input.jobId)
    const result = metadata.status === JobStatus.COMPLETED
      ? repo.getResult(input.jobId)
      : null
    return { metadata, result }
  })

  // Delete job and all its files
  handleIpc(IPC.JOBS_DELETE, jobDeleteInputSchema, (input) => {
    const existing = repo.get(input.jobId)
    if (!existing) throw new JobNotFoundError(input.jobId)
    repo.delete(input.jobId)
  })

  // Rename job (update display name)
  handleIpc(IPC.JOBS_RENAME, renameJobInputSchema, (input) => {
    const existing = repo.get(input.jobId)
    if (!existing) throw new JobNotFoundError(input.jobId)
    return repo.update(input.jobId, { displayName: input.displayName.trim() })
  })

  // Retry failed job (with optional resume from last offset)
  handleIpc(IPC.JOBS_RETRY, retryJobInputSchema, (input) => {
    const metadata = retryJobUc.execute(input.jobId, input.resume)
    queue.enqueue(metadata.id)
    return metadata
  })

  // Download output file — returns file path + suggested filename
  handleIpc(IPC.JOBS_DOWNLOAD, downloadInputSchema, (input) => {
    const filePath = repo.getOutputFile(input.jobId, input.format)
    if (!filePath) {
      throw new Error(`Output file not ready for job ${input.jobId} (format: ${input.format})`)
    }
    const metadata = repo.get(input.jobId)
    const stem = metadata ? path.parse(metadata.originalFilename).name : 'transcription'
    return { filePath, fileName: `${stem}_transcription.${input.format}` }
  })

  // Get partial transcript segments during active transcription
  handleIpc(
    IPC.JOBS_PARTIAL_TRANSCRIPT,
    z.object({ jobId: jobIdSchema }),
    (input) => {
      const segments = repo.getPartialSegments(input.jobId)
      const text = segments.map((s) => s.text).join(' ')
      return { segments, text }
    },
  )

  // Read transcript file content for in-app preview
  handleIpc(IPC.JOBS_GET_FILE_CONTENT, downloadInputSchema, (input) => {
    const filePath = repo.getOutputFile(input.jobId, input.format)
    if (!filePath) {
      throw new Error(`Output file not ready for job ${input.jobId} (format: ${input.format})`)
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    return { content }
  })
}
