import { Notification } from 'electron'
import type { BrowserWindow } from 'electron'
import { getDb } from './db/client'
import { config } from '../config'
import { FFmpegAudioExtractor } from './services/ffmpeg-audio-extractor'
import { WhisperTranscriber } from './services/whisper-transcriber'
import { WhisperFormatter } from './services/whisper-formatter'
import { DrizzleJobRepository } from './repositories/drizzle-job-repository'
import { DrizzleFolderRepository } from './repositories/drizzle-folder-repository'
import { CreateJobUseCase } from '../application/use-cases/create-job'
import { ProcessJobUseCase } from '../application/use-cases/process-job'
import { RetryJobUseCase } from '../application/use-cases/retry-job'
import { JobQueue } from '../application/job-queue'

/**
 * Composition root — the only place that wires concrete implementations
 * to use cases. Mirrors backend/infrastructure/http/dependencies.py.
 *
 * Must be called AFTER initDb() so that getDb() does not throw.
 */
export function createCompositionRoot() {
  // Late-binding main window reference (set after window creation)
  let mainWindow: BrowserWindow | null = null

  function sendEvent(channel: string, payload: unknown): void {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload)
    }
  }

  function notify(title: string, body: string): void {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show()
    }
  }

  // ── Infrastructure ──────────────────────────────────────────────────────────

  const repo = new DrizzleJobRepository(getDb(), config.jobFilesDir)
  const folderRepo = new DrizzleFolderRepository(getDb())

  const extractor = new FFmpegAudioExtractor(config.ffmpegPath, config.ffprobePath)

  // Tuning is read lazily so Settings changes apply to the next job without restart
  const transcriber = new WhisperTranscriber(
    config.whisperCliPath,
    config.modelsDir,
    () => ({
      noSpeechThold: config.whisper.noSpeechThold,
      entropyThold:  config.whisper.entropyThold,
      logprobThold:  config.whisper.logprobThold,
      maxContext:    config.whisper.maxContext,
    }),
  )

  const formatter = new WhisperFormatter()

  // ── Use cases ───────────────────────────────────────────────────────────────

  const createJobUc = new CreateJobUseCase(repo)

  const processJobUc = new ProcessJobUseCase(
    repo,
    extractor,
    transcriber,
    formatter,
    () => config.whisperThreads,
    sendEvent,
    notify,
  )

  const retryJobUc = new RetryJobUseCase(repo)

  // ── Job queue ───────────────────────────────────────────────────────────────

  const queue = new JobQueue((jobId: string) => processJobUc.execute(jobId).then(() => undefined))

  // ── Public interface ────────────────────────────────────────────────────────

  return {
    repo,
    folderRepo,
    createJobUc,
    retryJobUc,
    queue,
    setMainWindow(win: BrowserWindow | null): void {
      mainWindow = win
    },
  }
}

export type CompositionRoot = ReturnType<typeof createCompositionRoot>
