/**
 * Constants shared between main process and renderer.
 * Ported from backend/config.py + frontend conventions.
 */

export const ALLOWED_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.webm',
  '.mp3', '.wav', '.flac', '.ogg', '.m4a',
])

/** Audio-only extensions — used to pick an <audio> vs <video> player element. */
export const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a'])

export const KNOWN_MODELS = [
  { name: 'large-v3', sizeMb: 3094 },
  { name: 'medium',   sizeMb: 1533 },
  { name: 'small',    sizeMb: 488 },
  { name: 'base',     sizeMb: 148 },
  { name: 'tiny',     sizeMb: 77 },
] as const

export type KnownModelName = typeof KNOWN_MODELS[number]['name']

export const DEFAULT_MODEL = 'large-v3'
export const DEFAULT_LANGUAGE = 'es'

/** Whisper inference defaults — mirror backend/config.py. */
export const WHISPER_DEFAULTS = {
  threads: 8,
  noSpeechThold: 0.6,
  entropyThold: 2.4,
  logprobThold: -1.0,
  /** 0 = disable context window (prevents hallucination cascades). */
  maxContext: 0,
} as const

export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2 GB

export const JOB_ID_REGEX = /^[a-f0-9]{32}$/

export const DOWNLOAD_FORMATS = ['txt', 'json', 'srt', 'vtt'] as const
export type DownloadFormat = typeof DOWNLOAD_FORMATS[number]
