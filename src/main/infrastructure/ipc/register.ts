import { config } from '../../config'
import { registerJobHandlers } from './handlers/job-handlers'
import { registerFolderHandlers } from './handlers/folder-handlers'
import { registerModelHandlers } from './handlers/model-handlers'
import { registerAppHandlers } from './handlers/app-handlers'
import type { CompositionRoot } from '../composition-root'

/**
 * Register all IPC handlers for the main process.
 * Must be called after createCompositionRoot() and before createWindow().
 */
export function registerAllHandlers(root: CompositionRoot): void {
  registerJobHandlers(root.repo, root.folderRepo, root.createJobUc, root.retryJobUc, root.queue)
  registerFolderHandlers(root.folderRepo)
  registerModelHandlers(config.modelsDir, config)
  registerAppHandlers(config.ffmpegPath, config.whisperCliPath)
}
