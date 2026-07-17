import fs from 'node:fs'
import path from 'node:path'
import { IPC } from '../../../../shared/ipc-channels'
import {
  KNOWN_MODELS,
  DEFAULT_MODEL,
  DEFAULT_LANGUAGE,
  WHISPER_DEFAULTS,
} from '../../../../shared/constants'
import { whisperSettingsSchema, type WhisperSettings } from '../../../../shared/schemas'
import { ModelNotFoundError } from '../../../domain/errors'
import { handleIpc } from '../ipc-wrapper'
import type { config as AppConfig } from '../../../config'

function readSettings(cfg: typeof AppConfig): WhisperSettings {
  return {
    defaultModel:    cfg.defaultModel,
    defaultLanguage: cfg.defaultLanguage,
    threads:         cfg.whisperThreads,
    noSpeechThold:   cfg.whisper.noSpeechThold,
    entropyThold:    cfg.whisper.entropyThold,
    logprobThold:    cfg.whisper.logprobThold,
    maxContext:      cfg.whisper.maxContext,
  }
}

function applySettings(cfg: typeof AppConfig, s: WhisperSettings): WhisperSettings {
  cfg.defaultModel           = s.defaultModel
  cfg.defaultLanguage        = s.defaultLanguage
  cfg.whisperThreads         = s.threads
  cfg.whisper.noSpeechThold  = s.noSpeechThold
  cfg.whisper.entropyThold   = s.entropyThold
  cfg.whisper.logprobThold   = s.logprobThold
  cfg.whisper.maxContext     = s.maxContext
  return readSettings(cfg)
}

export function registerSettingsHandlers(cfg: typeof AppConfig): void {
  // Current whisper settings (persisted via electron-store)
  handleIpc(IPC.SETTINGS_GET, null, () => readSettings(cfg))

  // Validate and persist the full settings object; applies to the next job
  handleIpc(IPC.SETTINGS_UPDATE, whisperSettingsSchema, (input) => {
    if (!KNOWN_MODELS.some((m) => m.name === input.defaultModel)) {
      throw new ModelNotFoundError(input.defaultModel)
    }
    // Same rule as MODELS_SET_DEFAULT: the default model must be downloaded
    const modelPath = path.join(cfg.modelsDir, `ggml-${input.defaultModel}.bin`)
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model "${input.defaultModel}" is not downloaded`)
    }
    return applySettings(cfg, input)
  })

  // Restore every parameter to its shipped default
  handleIpc(IPC.SETTINGS_RESET, null, () =>
    applySettings(cfg, {
      defaultModel:    DEFAULT_MODEL,
      defaultLanguage: DEFAULT_LANGUAGE,
      threads:         WHISPER_DEFAULTS.threads,
      noSpeechThold:   WHISPER_DEFAULTS.noSpeechThold,
      entropyThold:    WHISPER_DEFAULTS.entropyThold,
      logprobThold:    WHISPER_DEFAULTS.logprobThold,
      maxContext:      WHISPER_DEFAULTS.maxContext,
    }),
  )
}
