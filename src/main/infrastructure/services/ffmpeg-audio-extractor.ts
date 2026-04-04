import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { ExtractionFailedError } from '../../domain/errors'

export type ProgressCallback = (pct: number) => void

const _FFT_TIME_US_RE = /^out_time_us=(\d+)/

/**
 * Extract the out_time_us value from an ffmpeg -progress output line.
 */
function parseFFmpegTimeUs(line: string): number | null {
  const m = _FFT_TIME_US_RE.exec(line)
  return m ? parseInt(m[1], 10) : null
}

export class FFmpegAudioExtractor {
  constructor(
    private readonly ffmpegPath: string,
    private readonly ffprobePath: string,
  ) {}

  /**
   * Get media duration in seconds using ffprobe.
   * Throws ExtractionFailedError if ffprobe fails or returns invalid data.
   */
  async getDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      const errChunks: Buffer[] = []

      const proc = spawn(this.ffprobePath, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        filePath,
      ])

      proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
      proc.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk))

      proc.on('close', (code) => {
        if (code !== 0) {
          const stderr = Buffer.concat(errChunks).toString('utf8')
          return reject(
            new ExtractionFailedError(
              `ffprobe failed (code ${code}): ${stderr}`,
            ),
          )
        }

        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          const duration = parseFloat(data?.format?.duration)
          if (!isFinite(duration)) throw new Error('invalid duration')
          resolve(duration)
        } catch (e) {
          reject(
            new ExtractionFailedError(
              `Could not parse duration from ffprobe output: ${e}`,
            ),
          )
        }
      })

      proc.on('error', (err) =>
        reject(new ExtractionFailedError(`ffprobe process error: ${err.message}`)),
      )
    })
  }

  /**
   * Extract audio from a media file as WAV 16 kHz mono.
   * Uses ffmpeg -progress pipe:1 to report real-time progress via onProgress callback.
   * Returns the duration in seconds.
   * Throws ExtractionFailedError on failure.
   */
  async extract(
    inputPath: string,
    outputPath: string,
    totalDuration?: number,
    onProgress?: ProgressCallback,
  ): Promise<number> {
    const duration = totalDuration ?? (await this.getDuration(inputPath))
    const totalUs = duration * 1_000_000

    return new Promise((resolve, reject) => {
      const proc = spawn(this.ffmpegPath, [
        '-i', inputPath,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-y',
        '-progress', 'pipe:1',
        outputPath,
      ])

      const rl = createInterface({ input: proc.stdout, crlfDelay: Infinity })

      rl.on('line', (line) => {
        const timeUs = parseFFmpegTimeUs(line)
        if (timeUs !== null && onProgress && totalUs > 0) {
          const pct = Math.min(timeUs / totalUs, 1.0)
          onProgress(pct)
        }
      })

      const errChunks: Buffer[] = []
      proc.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk))

      proc.on('close', (code) => {
        rl.close()
        if (code !== 0) {
          const stderr = Buffer.concat(errChunks).toString('utf8')
          return reject(
            new ExtractionFailedError(
              `FFmpeg audio extraction failed (code ${code}): ${stderr}`,
            ),
          )
        }
        resolve(duration)
      })

      proc.on('error', (err) =>
        reject(new ExtractionFailedError(`ffmpeg process error: ${err.message}`)),
      )
    })
  }
}
