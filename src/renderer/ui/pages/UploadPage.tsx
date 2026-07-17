import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { FileUploader } from '../components/FileUploader'
import {
  TranscriptionConfig,
  type TranscriptionConfigValues,
} from '../components/TranscriptionConfig'
import { ipc } from '../../infrastructure/ipc-client'
import type { ModelInfo } from '../../../shared/types'

export function UploadPage() {
  const navigate = useNavigate()
  const [filePaths, setFilePaths] = useState<string[]>([])
  const [config, setConfig] = useState<TranscriptionConfigValues>({
    model: 'large-v3',
    language: 'es',
    outputFormats: ['txt', 'json', 'srt', 'vtt'],
  })
  const [models, setModels] = useState<readonly ModelInfo[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    ipc.listModels()
      .then((data) => {
        setModels(data.models)
        setConfig((prev) => ({ ...prev, model: data.default }))
      })
      .catch(() => {
        // Non-critical
      })
  }, [])

  const handleFilesSelected = useCallback((paths: string[]) => {
    setFilePaths(paths)
  }, [])

  const handleConfigChange = useCallback((next: TranscriptionConfigValues) => {
    setConfig(next)
  }, [])

  const handleSubmit = async () => {
    if (filePaths.length === 0) return
    setSubmitting(true)
    try {
      const apiConfig = { model: config.model, language: config.language }

      if (filePaths.length === 1) {
        const job = await ipc.createJob(filePaths[0]!, apiConfig)
        navigate(`/jobs/${job.id}`)
      } else {
        await ipc.createBatch(filePaths, apiConfig)
        navigate('/')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo iniciar la transcripción'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text-primary">
          <Upload size={20} className="text-accent-text" />
          Upload Media
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Select video or audio files to transcribe
        </p>
      </div>

      <div className="space-y-6 bg-surface border border-border-default rounded-lg p-6">
        <FileUploader onFilesSelected={handleFilesSelected} />

        <hr className="border-border-default" />

        <TranscriptionConfig
          config={config}
          onConfigChange={handleConfigChange}
          availableModels={models}
        />
      </div>

      <button
        type="button"
        disabled={filePaths.length === 0 || submitting}
        onClick={handleSubmit}
        className="flex items-center gap-2 px-5 py-2.5 bg-cta hover:bg-cta-hover text-white font-medium rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2 focus-visible:ring-cta focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        {submitting ? (
          <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
        ) : (
          <Sparkles size={16} />
        )}
        {submitting ? 'Iniciando transcripción...' : 'Transcribir'}
      </button>
    </div>
  )
}
