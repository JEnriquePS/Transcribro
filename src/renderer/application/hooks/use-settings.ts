import { useCallback, useEffect, useState } from 'react'
import { ipc } from '../../infrastructure/ipc-client'
import type { WhisperSettings } from '../../../shared/schemas'

/**
 * Load and mutate the persisted whisper settings.
 * `save`/`reset` return the settings echoed back by the main process.
 */
export function useSettings() {
  const [settings, setSettings] = useState<WhisperSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ipc
      .getSettings()
      .then(setSettings)
      .catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const save = useCallback(async (next: WhisperSettings): Promise<WhisperSettings> => {
    const saved = await ipc.updateSettings(next)
    setSettings(saved)
    return saved
  }, [])

  const reset = useCallback(async (): Promise<WhisperSettings> => {
    const restored = await ipc.resetSettings()
    setSettings(restored)
    return restored
  }, [])

  return { settings, loading, error, save, reset }
}
