import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { IPC } from '../../../../shared/ipc-channels'
import { KNOWN_MODELS } from '../../../../shared/constants'
import { modelSetDefaultInputSchema, modelNameInputSchema } from '../../../../shared/schemas'
import { ModelNotFoundError } from '../../../domain/errors'
import { handleIpc } from '../ipc-wrapper'
import type { config as AppConfig } from '../../../config'

const HUGGING_FACE_BASE = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main'

// Active download processes — keyed by model name
const downloadProcesses = new Map<string, ChildProcess>()

export function registerModelHandlers(
  modelsDir: string,
  cfg: typeof AppConfig,
): void {
  // List all known models with their download status
  handleIpc(IPC.MODELS_LIST, null, () => {
    const models = KNOWN_MODELS.map((m) => ({
      name: m.name,
      sizeMb: m.sizeMb,
      available: fs.existsSync(path.join(modelsDir, `ggml-${m.name}.bin`)),
    }))
    return { models, default: cfg.defaultModel }
  })

  // Set the default model (must already be downloaded)
  handleIpc(IPC.MODELS_SET_DEFAULT, modelSetDefaultInputSchema, (input) => {
    const known = KNOWN_MODELS.find((m) => m.name === input.name)
    if (!known) throw new ModelNotFoundError(input.name)

    const modelPath = path.join(modelsDir, `ggml-${input.name}.bin`)
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model "${input.name}" is not downloaded`)
    }

    cfg.defaultModel = input.name
  })

  // Start downloading a model from HuggingFace
  handleIpc(IPC.MODELS_DOWNLOAD, modelNameInputSchema, (input) => {
    const known = KNOWN_MODELS.find((m) => m.name === input.name)
    if (!known) throw new ModelNotFoundError(input.name)

    const modelPath = path.join(modelsDir, `ggml-${input.name}.bin`)
    if (fs.existsSync(modelPath)) {
      throw new Error(`Model "${input.name}" is already downloaded`)
    }
    if (downloadProcesses.has(input.name)) {
      throw new Error(`Model "${input.name}" is already downloading`)
    }

    fs.mkdirSync(modelsDir, { recursive: true })
    const partialPath = `${modelPath}.partial`
    const url = `${HUGGING_FACE_BASE}/ggml-${input.name}.bin`

    const proc = spawn('curl', ['-L', '-o', partialPath, url])
    downloadProcesses.set(input.name, proc)

    proc.on('close', (code) => {
      downloadProcesses.delete(input.name)
      if (code === 0 && fs.existsSync(partialPath)) {
        fs.renameSync(partialPath, modelPath)
      } else if (fs.existsSync(partialPath)) {
        fs.unlinkSync(partialPath)
      }
    })
  })

  // Cancel an in-progress model download
  handleIpc(IPC.MODELS_CANCEL_DOWNLOAD, modelNameInputSchema, (input) => {
    const proc = downloadProcesses.get(input.name)
    if (!proc) {
      throw new Error(`No active download for model "${input.name}"`)
    }
    proc.kill('SIGTERM')
    downloadProcesses.delete(input.name)
  })

  // Check download status for a specific model
  handleIpc(IPC.MODELS_STATUS, modelNameInputSchema, (input) => {
    const modelPath = path.join(modelsDir, `ggml-${input.name}.bin`)
    const partialPath = `${modelPath}.partial`

    if (fs.existsSync(modelPath)) {
      const sizeMb = Math.round((fs.statSync(modelPath).size / (1024 * 1024)) * 10) / 10
      return { status: 'ready', sizeMb }
    }

    if (downloadProcesses.has(input.name)) {
      const progressMb = fs.existsSync(partialPath)
        ? Math.round((fs.statSync(partialPath).size / (1024 * 1024)) * 10) / 10
        : 0
      return { status: 'downloading', progressMb }
    }

    return { status: 'not_downloaded' }
  })

  // Delete a downloaded model
  handleIpc(IPC.MODELS_DELETE, modelNameInputSchema, (input) => {
    const known = KNOWN_MODELS.find((m) => m.name === input.name)
    if (!known) throw new ModelNotFoundError(input.name)

    const modelPath = path.join(modelsDir, `ggml-${input.name}.bin`)
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model "${input.name}" is not downloaded`)
    }

    fs.unlinkSync(modelPath)
  })
}
