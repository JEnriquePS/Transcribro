import fs from 'node:fs'
import { dialog, shell } from 'electron'
import { IPC } from '../../../../shared/ipc-channels'
import { ALLOWED_EXTENSIONS } from '../../../../shared/constants'
import { handleIpc } from '../ipc-wrapper'

export function registerAppHandlers(
  ffmpegPath: string,
  whisperCliPath: string,
): void {
  // Health check — verify required binaries are present
  handleIpc(IPC.APP_HEALTH, null, () => {
    return {
      status: 'ok',
      whisperAvailable: binaryExists(whisperCliPath),
      ffmpegAvailable: binaryExists(ffmpegPath),
    }
  })

  // Open native file picker and return selected file paths
  handleIpc(IPC.APP_SELECT_FILES, null, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Media Files',
          // ALLOWED_EXTENSIONS entries are like ".mp4" — strip the leading dot
          extensions: [...ALLOWED_EXTENSIONS].map((ext) => ext.slice(1)),
        },
      ],
    })
    return result.canceled ? [] : result.filePaths
  })

  // Reveal a file in the OS file manager (Finder on macOS)
  handleIpc(IPC.APP_REVEAL_FILE, null, async (input: unknown) => {
    const { filePath } = input as { filePath: string }
    await shell.showItemInFolder(filePath)
  })
}

function binaryExists(binPath: string): boolean {
  try {
    const stat = fs.statSync(binPath)
    // Check executable bit (owner, group, or other)
    return (stat.mode & 0o111) !== 0
  } catch {
    return false
  }
}
