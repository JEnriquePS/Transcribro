import fs from 'node:fs'
import path from 'node:path'
import { eq, desc, count, isNull, isNotNull, inArray } from 'drizzle-orm'
import { jobs, transcriptSegments, transcriptResults } from '../db/schema'
import type { Db } from '../db/client'
import type { JobMetadata, TranscriptSegment, TranscriptResult } from '../../../shared/types'
import { JobStatus } from '../../../shared/types'
import { JobNotFoundError, UnsupportedFormatError } from '../../domain/errors'
import { validateJobId } from '../../domain/validation'

const FILE_MAP: Record<string, string> = {
  txt:  'transcript.txt',
  srt:  'transcript.srt',
  vtt:  'transcript.vtt',
  json: 'transcript.json',
}

type JobRow = typeof jobs.$inferSelect

function rowToMetadata(row: JobRow): JobMetadata {
  return {
    id:                    row.id,
    originalFilename:      row.originalFilename,
    displayName:           row.displayName ?? null,
    status:                row.status as JobStatus,
    config: {
      model:    row.model,
      language: row.language,
      threads:  row.threads ?? undefined,
    },
    error:                 row.error ?? null,
    progress:              row.progress,
    extractionProgress:    row.extractionProgress,
    transcriptionProgress: row.transcriptionProgress,
    formattingProgress:    row.formattingProgress,
    lastOffsetMs:          row.lastOffsetMs ?? null,
    createdAt:             row.createdAt ?? null,
    startedAt:             row.startedAt ?? null,
    completedAt:           row.completedAt ?? null,
    durationSeconds:       row.durationSeconds ?? null,
    folderId:              row.folderId ?? null,
  }
}

export class DrizzleJobRepository {
  constructor(
    private readonly db: Db,
    private readonly jobFilesDir: string,
  ) {}

  private jobDir(jobId: string): string {
    validateJobId(jobId)
    const resolved = path.resolve(path.join(this.jobFilesDir, jobId))
    if (!resolved.startsWith(path.resolve(this.jobFilesDir))) {
      throw new Error(`Invalid job path: ${JSON.stringify(jobId)}`)
    }
    return resolved
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  save(job: JobMetadata): void {
    const dir = this.jobDir(job.id)
    fs.mkdirSync(dir, { recursive: true })

    this.db
      .insert(jobs)
      .values({
        id:                    job.id,
        originalFilename:      job.originalFilename,
        displayName:           job.displayName ?? null,
        status:                job.status,
        model:                 job.config.model,
        language:              job.config.language,
        threads:               job.config.threads ?? null,
        error:                 job.error ?? null,
        progress:              job.progress,
        extractionProgress:    job.extractionProgress,
        transcriptionProgress: job.transcriptionProgress,
        formattingProgress:    job.formattingProgress,
        lastOffsetMs:          job.lastOffsetMs ?? null,
        createdAt:             job.createdAt ?? null,
        startedAt:             job.startedAt ?? null,
        completedAt:           job.completedAt ?? null,
        durationSeconds:       job.durationSeconds ?? null,
        folderId:              job.folderId ?? null,
      })
      .onConflictDoUpdate({
        target: jobs.id,
        set: {
          displayName:           job.displayName ?? null,
          status:                job.status,
          model:                 job.config.model,
          language:              job.config.language,
          threads:               job.config.threads ?? null,
          error:                 job.error ?? null,
          progress:              job.progress,
          extractionProgress:    job.extractionProgress,
          transcriptionProgress: job.transcriptionProgress,
          formattingProgress:    job.formattingProgress,
          lastOffsetMs:          job.lastOffsetMs ?? null,
          startedAt:             job.startedAt ?? null,
          completedAt:           job.completedAt ?? null,
          durationSeconds:       job.durationSeconds ?? null,
          folderId:              job.folderId ?? null,
        },
      })
      .run()
  }

  get(jobId: string): JobMetadata | null {
    const row = this.db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .get()
    return row ? rowToMetadata(row) : null
  }

  /**
   * List jobs with optional folder filter.
   * - folderFilter === undefined     → all jobs (no WHERE clause)
   * - folderFilter === null          → uncategorized (WHERE folder_id IS NULL)
   * - folderFilter === string[]      → jobs in any of those folder IDs (WHERE folder_id IN (...))
   *                                    Pass [folderId, ...descendants] for recursive folder selection.
   */
  list(limit = 50, offset = 0, folderFilter?: null | readonly string[]): { jobs: JobMetadata[]; total: number } {
    const whereClause =
      folderFilter === undefined
        ? undefined
        : folderFilter === null
          ? isNull(jobs.folderId)
          : inArray(jobs.folderId, folderFilter as string[])

    const baseQuery = this.db.select().from(jobs)
    const countQuery = this.db.select({ value: count() }).from(jobs)

    const rows = (whereClause ? baseQuery.where(whereClause) : baseQuery)
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    const [{ value: total }] = (whereClause ? countQuery.where(whereClause) : countQuery).all()

    return { jobs: rows.map(rowToMetadata), total }
  }

  /** Direct (non-recursive) job count per folder — used to badge folder tiles in the UI. */
  countByFolder(): Record<string, number> {
    const rows = this.db
      .select({ folderId: jobs.folderId, value: count() })
      .from(jobs)
      .where(isNotNull(jobs.folderId))
      .groupBy(jobs.folderId)
      .all()

    return Object.fromEntries(rows.map((r) => [r.folderId as string, r.value]))
  }

  moveToFolder(jobId: string, folderId: string | null): JobMetadata {
    const existing = this.get(jobId)
    if (!existing) throw new JobNotFoundError(jobId)
    this.db.update(jobs).set({ folderId }).where(eq(jobs.id, jobId)).run()
    return { ...existing, folderId }
  }

  update(jobId: string, fields: Partial<Omit<JobMetadata, 'id'>>): JobMetadata {
    const current = this.get(jobId)
    if (!current) throw new JobNotFoundError(jobId)

    const merged: JobMetadata = {
      ...current,
      ...fields,
      config: fields.config ?? current.config,
    }
    this.save(merged)
    return merged
  }

  delete(jobId: string): void {
    this.db.delete(jobs).where(eq(jobs.id, jobId)).run()
    const dir = this.jobDir(jobId)
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }

  // ── File helpers ──────────────────────────────────────────────────────────

  getJobDir(jobId: string): string {
    return this.jobDir(jobId)
  }

  /**
   * Copy a file into the job directory and return the destination path.
   * The original extension is preserved as `input<ext>`.
   */
  copyInputFile(jobId: string, sourcePath: string): string {
    const ext = path.extname(sourcePath) || '.mp4'
    const dest = path.join(this.jobDir(jobId), `input${ext}`)
    fs.copyFileSync(sourcePath, dest)
    return dest
  }

  /** Resolve the copied original media file (`input.<ext>`) for a job, or null if missing. */
  getInputFile(jobId: string): string | null {
    const dir = this.jobDir(jobId)
    if (!fs.existsSync(dir)) return null
    const found = fs.readdirSync(dir).find((f) => path.parse(f).name === 'input')
    return found ? path.join(dir, found) : null
  }

  /** Resolve the extracted 16kHz mono audio (`audio.wav`) for a job, or null if missing. */
  getExtractedAudioFile(jobId: string): string | null {
    const file = path.join(this.jobDir(jobId), 'audio.wav')
    return fs.existsSync(file) ? file : null
  }

  getOutputFile(jobId: string, fmt: string): string | null {
    const filename = FILE_MAP[fmt]
    if (!filename) throw new UnsupportedFormatError(fmt)
    const filePath = path.join(this.jobDir(jobId), filename)
    return fs.existsSync(filePath) ? filePath : null
  }

  // ── Partial segments ──────────────────────────────────────────────────────

  getPartialSegments(jobId: string): TranscriptSegment[] {
    return this.db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.jobId, jobId))
      .all()
      .map((r) => ({ start: r.start, end: r.end, text: r.text }))
  }

  savePartialSegments(jobId: string, segments: TranscriptSegment[]): void {
    // Delete existing partial segments then re-insert
    this.db
      .delete(transcriptSegments)
      .where(eq(transcriptSegments.jobId, jobId))
      .run()

    if (segments.length === 0) return

    this.db
      .insert(transcriptSegments)
      .values(
        segments.map((s) => ({
          jobId,
          start:     s.start,
          end:       s.end,
          text:      s.text,
          isPartial: true,
        })),
      )
      .run()
  }

  // ── Final result ──────────────────────────────────────────────────────────

  saveResult(result: TranscriptResult, enrichedJson: string): void {
    // Finalise segments (mark isPartial = false)
    this.db
      .delete(transcriptSegments)
      .where(eq(transcriptSegments.jobId, result.jobId))
      .run()

    if (result.segments.length > 0) {
      this.db
        .insert(transcriptSegments)
        .values(
          result.segments.map((s) => ({
            jobId:     result.jobId,
            start:     s.start,
            end:       s.end,
            text:      s.text,
            isPartial: false,
          })),
        )
        .run()
    }

    this.db
      .insert(transcriptResults)
      .values({
        jobId:       result.jobId,
        model:       result.model,
        language:    result.language,
        fullText:    result.fullText,
        enrichedJson,
      })
      .onConflictDoUpdate({
        target: transcriptResults.jobId,
        set: {
          model:       result.model,
          language:    result.language,
          fullText:    result.fullText,
          enrichedJson,
        },
      })
      .run()
  }

  getResult(jobId: string): TranscriptResult | null {
    const row = this.db
      .select()
      .from(transcriptResults)
      .where(eq(transcriptResults.jobId, jobId))
      .get()

    if (!row) return null

    const segments = this.db
      .select()
      .from(transcriptSegments)
      .where(eq(transcriptSegments.jobId, jobId))
      .all()
      .map((r) => ({ start: r.start, end: r.end, text: r.text }))

    const meta = this.get(jobId)

    return {
      jobId,
      originalFilename: meta?.originalFilename ?? '',
      model:            row.model,
      language:         row.language,
      fullText:         row.fullText,
      segments,
    }
  }
}
