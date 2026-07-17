import { app } from 'electron'
import path from 'node:path'
import Store from 'electron-store'
import { DEFAULT_MODEL, DEFAULT_LANGUAGE, WHISPER_DEFAULTS } from '../shared/constants'

type StoreSchema = {
  defaultModel: string
  defaultLanguage: string
  whisperThreads: number
  noSpeechThold: number
  entropyThold: number
  logprobThold: number
  maxContext: number
}

const store = new Store<StoreSchema>()

/**
 * Resolve a bundled binary/resource path.
 * - Dev:  <project-root>/resources/<relativePath>
 * - Prod: <process.resourcesPath>/<relativePath>
 */
function getResourcePath(relativePath: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, relativePath)
  }
  // __dirname is dist-electron/ at runtime; step up one level to project root
  return path.join(__dirname, '../resources', relativePath)
}

export const config = {
  // ── Binary paths (platform-specific) ────────────────────────────────────────
  whisperCliPath: getResourcePath('bin/whisper-cli'),
  ffmpegPath:     getResourcePath('bin/ffmpeg'),
  ffprobePath:    getResourcePath('bin/ffprobe'),

  // ── User-data paths ──────────────────────────────────────────────────────────
  modelsDir:   path.join(app.getPath('userData'), 'models'),
  dbPath:      path.join(app.getPath('userData'), 'transcribro.db'),
  jobFilesDir: path.join(app.getPath('userData'), 'jobs'),

  // ── Persisted settings (via electron-store) ──────────────────────────────────
  get defaultModel(): string  { return store.get('defaultModel', DEFAULT_MODEL) },
  set defaultModel(v: string) { store.set('defaultModel', v) },

  get defaultLanguage(): string  { return store.get('defaultLanguage', DEFAULT_LANGUAGE) },
  set defaultLanguage(v: string) { store.set('defaultLanguage', v) },

  get whisperThreads(): number  { return store.get('whisperThreads', WHISPER_DEFAULTS.threads) },
  set whisperThreads(v: number) { store.set('whisperThreads', v) },

  // ── Whisper tuning (persisted; defaults in shared/constants.ts) ─────────────
  whisper: {
    get noSpeechThold(): number  { return store.get('noSpeechThold', WHISPER_DEFAULTS.noSpeechThold) },
    set noSpeechThold(v: number) { store.set('noSpeechThold', v) },

    get entropyThold(): number  { return store.get('entropyThold', WHISPER_DEFAULTS.entropyThold) },
    set entropyThold(v: number) { store.set('entropyThold', v) },

    get logprobThold(): number  { return store.get('logprobThold', WHISPER_DEFAULTS.logprobThold) },
    set logprobThold(v: number) { store.set('logprobThold', v) },

    get maxContext(): number  { return store.get('maxContext', WHISPER_DEFAULTS.maxContext) },
    set maxContext(v: number) { store.set('maxContext', v) },
  },
} as const
