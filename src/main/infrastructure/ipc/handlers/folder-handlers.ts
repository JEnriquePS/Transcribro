import { IPC } from '../../../../shared/ipc-channels'
import {
  createFolderInputSchema,
  renameFolderInputSchema,
  deleteFolderInputSchema,
} from '../../../../shared/schemas'
import { handleIpc } from '../ipc-wrapper'
import type { DrizzleFolderRepository } from '../../repositories/drizzle-folder-repository'

export function registerFolderHandlers(folderRepo: DrizzleFolderRepository): void {
  handleIpc(IPC.FOLDERS_LIST, null, () => {
    return { folders: folderRepo.list() }
  })

  handleIpc(IPC.FOLDERS_CREATE, createFolderInputSchema, (input) => {
    return folderRepo.create(input.name.trim(), input.parentId ?? null)
  })

  handleIpc(IPC.FOLDERS_RENAME, renameFolderInputSchema, (input) => {
    return folderRepo.rename(input.folderId, input.name.trim())
  })

  handleIpc(IPC.FOLDERS_DELETE, deleteFolderInputSchema, (input) => {
    folderRepo.delete(input.folderId)
  })
}
