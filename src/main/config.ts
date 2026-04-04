import { app } from 'electron'
import path from 'node:path'
import Store from 'electron-store'

type StoreSchema = {
  defaultModel: string
  defaultLanguage: string
  whisperThreads: number
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
  get defaultModel(): string  { return store.get('defaultModel', 'large-v3') },
  set defaultModel(v: string) { store.set('defaultModel', v) },

  get defaultLanguage(): string  { return store.get('defaultLanguage', 'es') },
  set defaultLanguage(v: string) { store.set('defaultLanguage', v) },

  get whisperThreads(): number  { return store.get('whisperThreads', 8) },
  set whisperThreads(v: number) { store.set('whisperThreads', v) },

  // ── Whisper hard-coded tuning ─────────────────────────────────────────────────
  whisper: {
    noSpeechThold: 0.6,
    entropyThold:  2.4,
    logprobThold:  -1.0,
    maxContext:    0,
  },
} as const
