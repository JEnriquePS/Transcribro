import fs from 'node:fs'
import path from 'node:path'
import type { JobMetadata, TranscriptResult } from '../../../shared/types'
import { JobStatus } from '../../../shared/types'
import { IPC } from '../../../shared/ipc-channels'
import { JobNotFoundError } from '../../domain/errors'
import type { DrizzleJobRepository } from '../../infrastructure/repositories/drizzle-job-repository'
import type { FFmpegAudioExtractor } from '../../infrastructure/services/ffmpeg-audio-extractor'
import type { WhisperTranscriber } from '../../infrastructure/services/whisper-transcriber'
import type { WhisperFormatter } from '../../infrastructure/services/whisper-formatter'

export type SendEventFn = (channel: string, payload: unknown) => void

function nowIso(): string {
  return new Date().toISOString()
}

function computeDuration(startedAt: string | null, completedAt: string): number | null {
  if (!startedAt) return null
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  // Round to 2 decimal places (same as Python's round(..., 2))
  return Math.round((end - start) / 10) / 100
}

function buildProgressEvent(jobId: string, m: JobMetadata) {
  return {
    jobId,
    status: m.status,
    progress: m.progress,
    extractionProgress: m.extractionProgress,
    transcriptionProgress: m.transcriptionProgress,
    formattingProgress: m.formattingProgress,
    lastOffsetMs: m.lastOffsetMs,
  }
}

/**
 * Run the full transcription pipeline for a job.
 *
 * Pipeline stages and progress ranges (mirrors process_job.py):
 *   FFmpeg extraction : 0.05 → 0.20  (weight 0.15)
 *   Transcription     : 0.20 → 0.90  (weight 0.70)
 *   Formatting        : 0.90 → 1.00  (weight 0.10)
 */
export class ProcessJobUseCase {
  constructor(
    private readonly repo: DrizzleJobRepository,
    private readonly extractor: FFmpegAudioExtractor,
    private readonly transcriber: WhisperTranscriber,
    private readonly formatter: WhisperFormatter,
    private readonly defaultThreads: number,
    private readonly sendEvent: SendEventFn,
  ) {}

  private makeStageCallback(
    jobId: string,
    stageField: 'extractionProgress' | 'transcriptionProgress' | 'formattingProgress',
    overallBase: number,
    stageWeight: number,
  ): (pct: number) => void {
    return (pct: number): void => {
      const overall = overallBase + pct * stageWeight
      const updated = this.repo.update(jobId, {
        [stageField]: Math.round(pct * 1000) / 1000,
        progress: Math.round(overall * 1000) / 1000,
      })
      this.sendEvent(IPC.JOB_PROGRESS, buildProgressEvent(jobId, updated))
    }
  }

  private makeSegmentCallback(jobId: string): {
    callback: (start: number, end: number, text: string) => void
    segments: Array<{ start: number; end: number; text: string }>
  } {
    const segments = this.repo
      .getPartialSegments(jobId)
      .map((s) => ({ start: s.start, end: s.end, text: s.text }))

    const callback = (start: number, end: number, text: string): void => {
      segments.push({ start, end, text })
      this.repo.savePartialSegments(jobId, segments)
    }

    return { callback, segments }
  }

  async execute(jobId: string): Promise<JobMetadata> {
    try {
      const metadata = this.repo.get(jobId)
      if (!metadata) throw new JobNotFoundError(jobId)

      const jobDir = this.repo.getJobDir(jobId)
      const config = metadata.config

      this.repo.update(jobId, { startedAt: nowIso() })

      const inputPath = this.repo.getInputFile(jobId)
      if (!inputPath) throw new Error('No input file found in job directory')
      const audioPath = path.join(jobDir, 'audio.wav')

      // Determine if this is a resume (extraction already done, has offset)
      const isResume =
        metadata.extractionProgress >= 1.0 &&
        fs.existsSync(audioPath) &&
        metadata.lastOffsetMs !== null

      let offsetMs = 0

      if (isResume) {
        // Resume: skip extraction, use offset with 30s overlap
        offsetMs = Math.max(0, metadata.lastOffsetMs! - 30_000)
        const existing = this.repo.getPartialSegments(jobId)
        if (existing.length > 0) {
          const overlapStart = offsetMs / 1000
          const filtered = existing.filter((s) => s.end <= overlapStart)
          this.repo.savePartialSegments(jobId, filtered)
        }
      } else {
        // Full run: extract audio (0.05 → 0.20)
        const totalDuration = await this.extractor.getDuration(inputPath)
        this.repo.update(jobId, {
          status: JobStatus.EXTRACTING,
          progress: 0.05,
          extractionProgress: 0,
        })

        await this.extractor.extract(
          inputPath,
          audioPath,
          totalDuration,
          this.makeStageCallback(jobId, 'extractionProgress', 0.05, 0.15),
        )

        this.repo.update(jobId, { extractionProgress: 1.0, progress: 0.2 })
      }

      // Step 2: Transcribe (0.20 → 0.90)
      const transcribingState = this.repo.update(jobId, {
        status: JobStatus.TRANSCRIBING,
        progress: 0.2,
        transcriptionProgress: 0,
      })
      this.sendEvent(IPC.JOB_PROGRESS, buildProgressEvent(jobId, transcribingState))

      const threads = config.threads ?? this.defaultThreads
      const { callback: segmentCallback } = this.makeSegmentCallback(jobId)

      let result: TranscriptResult = await this.transcriber.transcribe({
        audioPath,
        outputDir: jobDir,
        language: config.language,
        modelSize: config.model,
        threads,
        offsetMs,
        onProgress: this.makeStageCallback(jobId, 'transcriptionProgress', 0.2, 0.7),
        onSegment: segmentCallback,
      })

      this.repo.update(jobId, { transcriptionProgress: 1.0, progress: 0.9 })

      // Attach job ID and original filename (from metadata) to the result
      result = {
        jobId,
        originalFilename: metadata.originalFilename,
        model: result.model,
        language: result.language,
        segments: result.segments,
        fullText: result.fullText,
      }

      // Step 3: Format enriched JSON (0.90 → 1.00)
      const formattingState = this.repo.update(jobId, {
        status: JobStatus.FORMATTING,
        progress: 0.9,
        formattingProgress: 0,
      })
      this.sendEvent(IPC.JOB_PROGRESS, buildProgressEvent(jobId, formattingState))

      const enrichedJson = this.formatter.format(result)
      // Write enriched JSON over the raw whisper JSON output
      fs.writeFileSync(path.join(jobDir, 'transcript.json'), enrichedJson, 'utf-8')
      // Persist to DB so getResult() works
      this.repo.saveResult(result, enrichedJson)

      const now = nowIso()
      const before = this.repo.get(jobId)
      const final = this.repo.update(jobId, {
        status: JobStatus.COMPLETED,
        progress: 1.0,
        formattingProgress: 1.0,
        completedAt: now,
        durationSeconds: computeDuration(before?.startedAt ?? null, now),
      })

      this.sendEvent(IPC.JOB_COMPLETED, { jobId, metadata: final })
      return final
    } catch (exc) {
      console.error(`[process-job] Job ${jobId} failed:`, exc)

      const now = nowIso()
      const current = this.repo.get(jobId)

      // Pick up last offset from partial segments
      let lastOffset = current?.lastOffsetMs ?? null
      const segments = this.repo.getPartialSegments(jobId)
      if (segments.length > 0) {
        try {
          lastOffset = Math.round(segments[segments.length - 1].end * 1000)
        } catch {
          // ignore — keep previous lastOffset
        }
      }

      // Use a safe, stage-specific error message (don't leak internal details)
      const stage = current?.status ?? ''
      const stageMessages: Record<string, string> = {
        [JobStatus.EXTRACTING]:   'Audio extraction failed',
        [JobStatus.TRANSCRIBING]: 'Transcription failed',
        [JobStatus.FORMATTING]:   'Formatting failed',
      }
      const safeError = stageMessages[stage] ?? 'Processing failed'

      const failed = this.repo.update(jobId, {
        status: JobStatus.FAILED,
        error: safeError,
        completedAt: now,
        durationSeconds: computeDuration(current?.startedAt ?? null, now),
        lastOffsetMs: lastOffset,
      })

      this.sendEvent(IPC.JOB_FAILED, { jobId, error: safeError })
      return failed
    }
  }
}
