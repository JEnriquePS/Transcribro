import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import path from 'node:path'
import fs from 'node:fs'
import type { TranscriptResult, TranscriptSegment } from '../../../shared/types'
import { TranscriptionFailedError } from '../../domain/errors'

export type ProgressCallback = (pct: number) => void
export type SegmentCallback = (start: number, end: number, text: string) => void

// Matches: "progress = 42%"
const _PROGRESS_RE = /progress\s*=\s*(\d+)%/

// Matches: [00:01:23.456 --> 00:01:28.789]   text here
const _SEGMENT_RE =
  /^\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]\s*(.+)/

// Strip ANSI color codes from whisper.cpp output
const _ANSI_RE = /\x1b\[[0-9;]*m/g

/** 5 minutes — matches Python's _READLINE_TIMEOUT */
const _READLINE_TIMEOUT_MS = 300_000

export interface TranscribeOptions {
  readonly audioPath: string
  readonly outputDir: string
  readonly language: string
  readonly modelSize: string
  readonly threads: number
  readonly offsetMs?: number
  readonly onProgress?: ProgressCallback
  readonly onSegment?: SegmentCallback
}

/** Tunable whisper.cpp decoding parameters — resolved per transcription run. */
export interface WhisperTuning {
  readonly noSpeechThold: number
  readonly entropyThold: number
  readonly logprobThold: number
  readonly maxContext: number
}

export interface WhisperArgsInput {
  readonly modelPath: string
  readonly audioPath: string
  readonly outputPrefix: string
  readonly language: string
  readonly threads: number
  readonly offsetMs: number
}

/** Build the full whisper-cli argument list. Pure — exported for testing. */
export function buildWhisperArgs(input: WhisperArgsInput, tuning: WhisperTuning): string[] {
  const args = [
    '-m', input.modelPath,
    '-f', input.audioPath,
    '-of', input.outputPrefix,
    '--output-json',
    '--output-srt',
    '--output-vtt',
    '--output-txt',
    '--print-progress',
    '-t', String(input.threads),
    '--no-speech-thold', String(tuning.noSpeechThold),
    '--entropy-thold',   String(tuning.entropyThold),
    '--logprob-thold',   String(tuning.logprobThold),
    '--max-context',     String(tuning.maxContext),
  ]

  if (input.offsetMs > 0) {
    args.push('--offset', String(input.offsetMs))
  }

  if (input.language === 'auto') {
    args.push('--detect-language')
  } else {
    args.push('-l', input.language)
  }

  return args
}

function parseTimestamp(h: string, m: string, s: string, ms: string): number {
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000
}

function deduplicateConsecutive(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (segments.length === 0) return segments
  const result: TranscriptSegment[] = [segments[0]]
  for (const seg of segments.slice(1)) {
    if (seg.text !== result[result.length - 1].text) {
      result.push(seg)
    }
  }
  return result
}

export function parseWhisperJson(jsonPath: string, requestedLanguage: string): TranscriptResult {
  if (!fs.existsSync(jsonPath)) {
    throw new TranscriptionFailedError('Transcription output not found')
  }

  let raw: unknown
  try {
    raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  } catch (e) {
    throw new TranscriptionFailedError(`Failed to read transcription output: ${e}`)
  }

  const data = raw as Record<string, unknown>
  const transcription = (data.transcription as unknown[]) ?? []
  const detectedLanguage =
    ((data.result as Record<string, unknown>)?.language as string) ?? requestedLanguage

  const rawSegments: TranscriptSegment[] = []
  for (const entry of transcription) {
    const e = entry as Record<string, unknown>
    const offsets = e.offsets as Record<string, number> | undefined
    const text = (e.text as string | undefined)?.trim() ?? ''
    if (!offsets || !text) continue
    rawSegments.push({
      start: offsets.from / 1000,
      end:   offsets.to / 1000,
      text,
    })
  }

  const segments = deduplicateConsecutive(rawSegments)
  const fullText = segments.map((s) => s.text).join(' ')
  const model = ((data.model as Record<string, unknown>)?.type as string) ?? 'unknown'

  return {
    jobId: '',
    originalFilename: '',
    model,
    language: detectedLanguage,
    segments,
    fullText,
  }
}

export class WhisperTranscriber {
  constructor(
    private readonly whisperCliPath: string,
    private readonly modelsDir: string,
    /** Resolved on every run so settings changes apply without restarting the app. */
    private readonly getTuning: () => WhisperTuning,
  ) {}

  private getModelPath(modelSize: string): string {
    const modelPath = path.join(this.modelsDir, `ggml-${modelSize}.bin`)
    if (!fs.existsSync(modelPath)) {
      throw new TranscriptionFailedError(`Model '${modelSize}' is not available`)
    }
    return modelPath
  }

  /**
   * Run whisper-cli to transcribe an audio file.
   * Reads stderr for progress, stdout for live segments.
   * Returns a TranscriptResult parsed from the JSON output file.
   * Throws TranscriptionFailedError on failure or timeout.
   */
  async transcribe(opts: TranscribeOptions): Promise<TranscriptResult> {
    const {
      audioPath,
      outputDir,
      language,
      modelSize,
      threads,
      offsetMs = 0,
      onProgress,
      onSegment,
    } = opts

    const modelPath = this.getModelPath(modelSize)
    const outputPrefix = path.join(outputDir, 'transcript')

    const cmd = buildWhisperArgs(
      { modelPath, audioPath, outputPrefix, language, threads, offsetMs },
      this.getTuning(),
    )

    const proc = spawn(this.whisperCliPath, cmd)

    return new Promise((resolve, reject) => {
      let settled = false

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true
          fn()
        }
      }

      // ── stdout: live segment parsing ──
      const stdoutRl = createInterface({ input: proc.stdout, crlfDelay: Infinity })
      let lastText: string | null = null

      stdoutRl.on('line', (raw) => {
        const line = raw.replace(_ANSI_RE, '').trim()
        if (!line) return
        const m = _SEGMENT_RE.exec(line)
        if (m && onSegment) {
          const start = parseTimestamp(m[1], m[2], m[3], m[4])
          const end   = parseTimestamp(m[5], m[6], m[7], m[8])
          const text  = m[9].trim()
          if (text === lastText) return
          lastText = text
          onSegment(start, end, text)
        }
      })

      // ── stderr: progress lines with timeout ──
      const stderrRl = createInterface({ input: proc.stderr, crlfDelay: Infinity })

      let timeoutHandle = setTimeout(() => {
        proc.kill()
        settle(() =>
          reject(new TranscriptionFailedError('whisper-cli timed out — no output for 5 minutes')),
        )
      }, _READLINE_TIMEOUT_MS)

      stderrRl.on('line', (raw) => {
        // Reset timeout on any stderr output
        clearTimeout(timeoutHandle)
        timeoutHandle = setTimeout(() => {
          proc.kill()
          settle(() =>
            reject(
              new TranscriptionFailedError('whisper-cli timed out — no output for 5 minutes'),
            ),
          )
        }, _READLINE_TIMEOUT_MS)

        const line = raw.replace(_ANSI_RE, '').trim()
        if (!line) return

        const pm = _PROGRESS_RE.exec(line)
        if (pm && onProgress) {
          onProgress(parseInt(pm[1], 10) / 100)
        }
      })

      proc.on('close', (code) => {
        clearTimeout(timeoutHandle)
        stdoutRl.close()
        stderrRl.close()

        if (code !== 0) {
          return settle(() => reject(new TranscriptionFailedError('Transcription engine failed')))
        }

        try {
          const result = parseWhisperJson(`${outputPrefix}.json`, language)
          settle(() => resolve(result))
        } catch (e) {
          settle(() => reject(e))
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timeoutHandle)
        settle(() => reject(new TranscriptionFailedError(`whisper-cli process error: ${err.message}`)))
      })
    })
  }
}
