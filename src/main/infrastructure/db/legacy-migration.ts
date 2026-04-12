/**
 * legacy-migration.ts
 *
 * One-time migration: import existing data/jobs/ filesystem records into SQLite.
 *
 * Called at startup (before the window opens) guarded by an electron-store flag.
 * Safe to call multiple times — subsequent calls are no-ops.
 *
 * Migrates:
 *   - metadata.json           → jobs table
 *   - partial_segments.json   → transcript_segments table (isPartial = false)
 *   - transcript.json         → transcript_results table + transcript_segments
 *   - input.*, audio.wav, transcript.* files → copied to new jobFilesDir
 */

import fs from 'node:fs'
import path from 'node:path'
import Store from 'electron-store'
import { JobStatus } from '../../../shared/types'
import type { DrizzleJobRepository } from '../repositories/drizzle-job-repository'
import type { TranscriptResult, TranscriptSegment } from '../../../shared/types'

const log = {
  debug: (msg: string) => console.debug(`[legacy-migration] ${msg}`),
  info:  (ctx: object, msg: string) => console.info(`[legacy-migration] ${msg}`, ctx),
  warn:  (ctx: object, msg: string) => console.warn(`[legacy-migration] ${msg}`, ctx),
  error: (ctx: object, msg: string) => console.error(`[legacy-migration] ${msg}`, ctx),
}

// ── Compile-time types for raw legacy JSON ────────────────────────────────────

interface LegacyConfig {
  model: string
  language: string
  threads: number | null
}

interface LegacyMetadata {
  job_id: string
  original_filename: string
  display_name: string | null
  status: string
  config: LegacyConfig
  error: string | null
  progress: number
  extraction_progress: number
  transcription_progress: number
  formatting_progress: number
  last_offset_ms: number | null
  created_at: string | null
  started_at: string | null
  completed_at: string | null
  duration_seconds: number | null
}

interface LegacySegment {
  start: number
  end: number
  text: string
}

interface LegacyTranscript {
  job_id: string
  original_filename: string
  model: string
  language: string
  full_text: string
  segments: LegacySegment[]
}

// ── Status normalisation ──────────────────────────────────────────────────────

const STATUS_MAP: Record<string, JobStatus> = {
  pending:      JobStatus.PENDING,
  extracting:   JobStatus.EXTRACTING,
  transcribing: JobStatus.TRANSCRIBING,
  formatting:   JobStatus.FORMATTING,
  completed:    JobStatus.COMPLETED,
  failed:       JobStatus.FAILED,
}

function normaliseStatus(raw: string): JobStatus {
  return STATUS_MAP[raw] ?? JobStatus.FAILED
}

// ── Mapper: legacy metadata.json → JobMetadata ───────────────────────────────

function mapLegacyMetadata(raw: LegacyMetadata) {
  return {
    id:                    raw.job_id,
    originalFilename:      raw.original_filename,
    displayName:           raw.display_name ?? null,
    status:                normaliseStatus(raw.status),
    config: {
      model:    raw.config?.model    ?? 'large-v3',
      language: raw.config?.language ?? 'es',
      threads:  raw.config?.threads  ?? undefined,
    },
    error:                 raw.error  ?? null,
    progress:              raw.progress              ?? 0,
    extractionProgress:    raw.extraction_progress    ?? 0,
    transcriptionProgress: raw.transcription_progress ?? 0,
    formattingProgress:    raw.formatting_progress    ?? 0,
    lastOffsetMs:          raw.last_offset_ms  ?? null,
    createdAt:             raw.created_at      ?? null,
    startedAt:             raw.started_at      ?? null,
    completedAt:           raw.completed_at    ?? null,
    durationSeconds:       raw.duration_seconds ?? null,
    folderId:              null,
  } as const
}

// ── Migrate a single job directory ────────────────────────────────────────────

async function migrateJob(
  legacyJobDir: string,
  repo: DrizzleJobRepository,
  newJobFilesDir: string,
): Promise<'migrated' | 'skipped' | 'failed'> {
  const metadataPath = path.join(legacyJobDir, 'metadata.json')
  if (!fs.existsSync(metadataPath)) return 'skipped'

  let rawMeta: LegacyMetadata
  try {
    rawMeta = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as LegacyMetadata
  } catch {
    log.warn({ legacyJobDir }, 'legacy-migration: could not parse metadata.json — skipping')
    return 'failed'
  }

  const jobId = rawMeta.job_id
  if (!jobId || !/^[a-f0-9]{32}$/.test(jobId)) {
    log.warn({ jobId }, 'legacy-migration: invalid job_id — skipping')
    return 'failed'
  }

  try {
    // ── 1. Insert job metadata ──────────────────────────────────────────────
    const metadata = mapLegacyMetadata(rawMeta)
    repo.save(metadata)

    // ── 2. Copy files to new location ───────────────────────────────────────
    const newJobDir = path.join(newJobFilesDir, jobId)
    fs.mkdirSync(newJobDir, { recursive: true })

    const filesToCopy = [
      'audio.wav',
      'transcript.srt',
      'transcript.vtt',
      'transcript.txt',
      'transcript.json',
    ]

    // Copy input file (could be .mp4, .mkv, .mp3, etc.)
    for (const entry of fs.readdirSync(legacyJobDir)) {
      if (entry.startsWith('input.')) {
        filesToCopy.unshift(entry)
        break
      }
    }

    for (const file of filesToCopy) {
      const src = path.join(legacyJobDir, file)
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(newJobDir, file))
      }
    }

    // ── 3. Import transcript result (segments + full_text) ─────────────────
    const transcriptPath = path.join(legacyJobDir, 'transcript.json')
    if (fs.existsSync(transcriptPath)) {
      try {
        const rawTranscript = JSON.parse(
          fs.readFileSync(transcriptPath, 'utf-8'),
        ) as LegacyTranscript

        const segments: TranscriptSegment[] = (rawTranscript.segments ?? []).map((s) => ({
          start: s.start,
          end:   s.end,
          text:  s.text,
        }))

        const result: TranscriptResult = {
          jobId:            jobId,
          originalFilename: rawTranscript.original_filename ?? rawMeta.original_filename,
          model:            rawTranscript.model    ?? rawMeta.config?.model    ?? 'large-v3',
          language:         rawTranscript.language ?? rawMeta.config?.language ?? 'es',
          segments,
          fullText:         rawTranscript.full_text ?? '',
        }

        // Use the raw JSON as enrichedJson (already the formatted output)
        const enrichedJson = fs.readFileSync(transcriptPath, 'utf-8')
        repo.saveResult(result, enrichedJson)
      } catch (err) {
        log.warn({ jobId, err }, 'legacy-migration: could not import transcript.json')
        // Non-fatal — job metadata is still migrated
      }
    } else if (metadata.status === JobStatus.COMPLETED) {
      // Job is marked completed but transcript.json is missing — log warning only
      log.warn({ jobId }, 'legacy-migration: completed job has no transcript.json')
    }

    // ── 4. Import partial segments (non-completed jobs or corrupted completed) ─
    const partialPath = path.join(legacyJobDir, 'partial_segments.json')
    if (
      fs.existsSync(partialPath) &&
      metadata.status !== JobStatus.COMPLETED
    ) {
      try {
        const rawSegments = JSON.parse(
          fs.readFileSync(partialPath, 'utf-8'),
        ) as LegacySegment[]

        if (Array.isArray(rawSegments) && rawSegments.length > 0) {
          const segments: TranscriptSegment[] = rawSegments.map((s) => ({
            start: s.start,
            end:   s.end,
            text:  s.text,
          }))
          repo.savePartialSegments(jobId, segments)
        }
      } catch (err) {
        log.warn({ jobId, err }, 'legacy-migration: could not import partial_segments.json')
      }
    }

    log.info({ jobId }, 'legacy-migration: job migrated')
    return 'migrated'
  } catch (err) {
    log.error({ jobId, err }, 'legacy-migration: failed to migrate job')
    return 'failed'
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

type MigrationStore = {
  legacyMigrationComplete: boolean
}

const migrationStore = new Store<MigrationStore>({ name: 'migration-state' })

export async function migrateLegacyData(
  legacyJobsDir: string,
  repo: DrizzleJobRepository,
  newJobFilesDir: string,
): Promise<{ migrated: number; skipped: number; failed: number }> {
  // Guard: only run once
  if (migrationStore.get('legacyMigrationComplete', false)) {
    log.debug('already complete — skipping')
    return { migrated: 0, skipped: 0, failed: 0 }
  }

  if (!fs.existsSync(legacyJobsDir)) {
    log.info({ legacyJobsDir }, 'legacy-migration: source directory not found — nothing to migrate')
    migrationStore.set('legacyMigrationComplete', true)
    return { migrated: 0, skipped: 0, failed: 0 }
  }

  let migrated = 0
  let skipped = 0
  let failed = 0

  let jobDirs: string[]
  try {
    jobDirs = fs
      .readdirSync(legacyJobsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => path.join(legacyJobsDir, d.name))
  } catch (err) {
    log.error({ err }, 'legacy-migration: could not read legacyJobsDir')
    return { migrated: 0, skipped: 0, failed: 0 }
  }

  log.info({ count: jobDirs.length }, 'legacy-migration: starting')

  for (const jobDir of jobDirs) {
    const result = await migrateJob(jobDir, repo, newJobFilesDir)
    if (result === 'migrated') migrated++
    else if (result === 'skipped') skipped++
    else failed++
  }

  migrationStore.set('legacyMigrationComplete', true)

  log.info(
    { migrated, skipped, failed },
    'legacy-migration: complete',
  )

  return { migrated, skipped, failed }
}
