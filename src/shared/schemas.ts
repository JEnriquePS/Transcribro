/**
 * Zod schemas for all IPC inputs.
 * These are the single source of truth for runtime validation at the IPC boundary.
 */
import { z } from 'zod'
import {
  JOB_ID_REGEX,
  DOWNLOAD_FORMATS,
  DEFAULT_MODEL,
  DEFAULT_LANGUAGE,
  WHISPER_LIMITS,
} from './constants'

// ── Primitives ────────────────────────────────────────────────────────────────

export const jobIdSchema = z
  .string()
  .regex(JOB_ID_REGEX, 'Job ID must be a 32-char hex string')

// ── Input schemas ─────────────────────────────────────────────────────────────

export const transcriptionConfigSchema = z.object({
  model: z.string().min(1).default(DEFAULT_MODEL),
  language: z.string().min(1).default(DEFAULT_LANGUAGE),
  threads: z.number().int().positive().optional(),
})

/** Full whisper configuration persisted in settings — editable from the Settings page. */
export const whisperSettingsSchema = z.object({
  defaultModel:    z.string().min(1),
  defaultLanguage: z.string().min(1),
  threads: z.number().int()
    .min(WHISPER_LIMITS.threads.min).max(WHISPER_LIMITS.threads.max),
  noSpeechThold: z.number()
    .min(WHISPER_LIMITS.noSpeechThold.min).max(WHISPER_LIMITS.noSpeechThold.max),
  entropyThold: z.number()
    .min(WHISPER_LIMITS.entropyThold.min).max(WHISPER_LIMITS.entropyThold.max),
  logprobThold: z.number()
    .min(WHISPER_LIMITS.logprobThold.min).max(WHISPER_LIMITS.logprobThold.max),
  maxContext: z.number().int()
    .min(WHISPER_LIMITS.maxContext.min).max(WHISPER_LIMITS.maxContext.max),
})

export type WhisperSettings = z.infer<typeof whisperSettingsSchema>

export const createJobInputSchema = z.object({
  /** Absolute path to the media file on disk (selected via native dialog). */
  filePath: z.string().min(1),
  config: transcriptionConfigSchema,
})

export const createBatchInputSchema = z.object({
  filePaths: z.array(z.string().min(1)).min(1),
  config: transcriptionConfigSchema,
})

export const renameJobInputSchema = z.object({
  jobId: jobIdSchema,
  displayName: z.string().min(1).max(255),
})

export const downloadInputSchema = z.object({
  jobId: jobIdSchema,
  format: z.enum(DOWNLOAD_FORMATS),
})

export const retryJobInputSchema = z.object({
  jobId: jobIdSchema,
  resume: z.boolean().default(false),
})

export const paginationInputSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
})

// ── Folder schemas ────────────────────────────────────────────────────────────

export const folderIdSchema = z
  .string()
  .regex(JOB_ID_REGEX, 'Folder ID must be a 32-char hex string')

export const createFolderInputSchema = z.object({
  name:     z.string().min(1).max(100),
  parentId: folderIdSchema.nullable().optional(),
})

export const renameFolderInputSchema = z.object({
  folderId: folderIdSchema,
  name: z.string().min(1).max(100),
})

export const deleteFolderInputSchema = z.object({
  folderId: folderIdSchema,
})

export const moveJobToFolderInputSchema = z.object({
  jobId: jobIdSchema,
  folderId: folderIdSchema.nullable(),
})

// Extends pagination to support folder filter:
// undefined = all jobs, '__uncategorized__' = jobs with no folder, string = specific folder id
export const listJobsInputSchema = paginationInputSchema.extend({
  folderId: z.union([folderIdSchema, z.literal('__uncategorized__')]).optional(),
  // Matches job name OR full transcript text (completed jobs only)
  search: z.string().max(200).optional(),
})

export type CreateFolderInput = z.infer<typeof createFolderInputSchema>
export type RenameFolderInput = z.infer<typeof renameFolderInputSchema>
export type DeleteFolderInput = z.infer<typeof deleteFolderInputSchema>
export type MoveJobToFolderInput = z.infer<typeof moveJobToFolderInputSchema>
export type ListJobsInput = z.infer<typeof listJobsInputSchema>

export const jobGetInputSchema = z.object({
  jobId: jobIdSchema,
})

export const jobDeleteInputSchema = z.object({
  jobId: jobIdSchema,
})

export const deleteJobMediaInputSchema = z.object({
  jobId: jobIdSchema,
  kind: z.enum(['original', 'extracted']),
})

export const modelSetDefaultInputSchema = z.object({
  name: z.string().min(1),
})

export const modelNameInputSchema = z.object({
  name: z.string().min(1),
})

export const saveFileInputSchema = z.object({
  sourcePath:  z.string().min(1),
  defaultName: z.string().min(1),
})

// ── Inferred types (used in IpcMap) ───────────────────────────────────────────

export type TranscriptionConfigInput = z.infer<typeof transcriptionConfigSchema>
export type CreateJobInput = z.infer<typeof createJobInputSchema>
export type CreateBatchInput = z.infer<typeof createBatchInputSchema>
export type RenameJobInput = z.infer<typeof renameJobInputSchema>
export type DownloadInput = z.infer<typeof downloadInputSchema>
export type RetryJobInput = z.infer<typeof retryJobInputSchema>
export type PaginationInput = z.infer<typeof paginationInputSchema>
