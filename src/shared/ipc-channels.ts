/**
 * IPC channel registry — single source of truth for all main ↔ renderer communication.
 *
 * Usage:
 *   // Main process
 *   ipcMain.handle(IPC.JOBS_CREATE, handler)
 *
 *   // Renderer
 *   window.electronAPI.invoke(IPC.JOBS_CREATE, input)
 */
import type {
  CreateJobInput,
  CreateBatchInput,
  RenameJobInput,
  DownloadInput,
  RetryJobInput,
  CreateFolderInput,
  RenameFolderInput,
  DeleteFolderInput,
  MoveJobToFolderInput,
  ListJobsInput,
  WhisperSettings,
} from './schemas'
import type {
  JobMetadata,
  JobDetail,
  ModelInfo,
  JobProgressEvent,
  JobCompletedEvent,
  JobFailedEvent,
  Folder,
} from './types'

// ── Channel name constants ────────────────────────────────────────────────────

export const IPC = {
  // ── Jobs (invoke: renderer → main) ──
  JOBS_CREATE:             'jobs:create',
  JOBS_CREATE_BATCH:       'jobs:createBatch',
  JOBS_LIST:               'jobs:list',
  JOBS_GET:                'jobs:get',
  JOBS_DELETE:             'jobs:delete',
  JOBS_RENAME:             'jobs:rename',
  JOBS_RETRY:              'jobs:retry',
  JOBS_DOWNLOAD:           'jobs:download',
  JOBS_PARTIAL_TRANSCRIPT: 'jobs:partialTranscript',
  JOBS_DELETE_MEDIA:       'jobs:deleteMedia',

  // ── Models (invoke: renderer → main) ──
  MODELS_LIST:             'models:list',
  MODELS_SET_DEFAULT:      'models:setDefault',
  MODELS_DOWNLOAD:         'models:download',
  MODELS_CANCEL_DOWNLOAD:  'models:cancelDownload',
  MODELS_DELETE:           'models:delete',
  MODELS_STATUS:           'models:status',

  // ── Settings (invoke: renderer → main) ──
  SETTINGS_GET:            'settings:get',
  SETTINGS_UPDATE:         'settings:update',
  SETTINGS_RESET:          'settings:reset',

  // ── App (invoke: renderer → main) ──
  APP_HEALTH:              'app:health',
  APP_SELECT_FILES:        'app:selectFiles',
  APP_REVEAL_FILE:         'app:revealFile',
  APP_SAVE_FILE:           'app:saveFile',
  APP_GET_MEDIA_PORT:      'app:getMediaPort',

  // ── Jobs (extra helpers) ──
  JOBS_GET_FILE_CONTENT:   'jobs:getFileContent',

  // ── Folders (invoke: renderer → main) ──
  FOLDERS_LIST:            'folders:list',
  FOLDERS_CREATE:          'folders:create',
  FOLDERS_RENAME:          'folders:rename',
  FOLDERS_DELETE:          'folders:delete',

  // ── Job folder assignment ──
  JOBS_MOVE_TO_FOLDER:     'jobs:moveToFolder',

  // ── Push events (on: renderer ← main) ──
  JOB_PROGRESS:            'job:progress',
  JOB_COMPLETED:           'job:completed',
  JOB_FAILED:              'job:failed',
} as const

export type IpcChannel = typeof IPC[keyof typeof IPC]

// ── Type map: channel → { input, output } ────────────────────────────────────
// Output is always the success payload; errors are thrown as IpcError.

export interface IpcMap {
  [IPC.JOBS_CREATE]: {
    input: CreateJobInput
    output: JobMetadata
  }
  [IPC.JOBS_CREATE_BATCH]: {
    input: CreateBatchInput
    output: JobMetadata[]
  }
  [IPC.JOBS_LIST]: {
    input: ListJobsInput
    output: { jobs: JobMetadata[]; total: number }
  }
  [IPC.JOBS_GET]: {
    input: { jobId: string }
    output: JobDetail
  }
  [IPC.JOBS_DELETE]: {
    input: { jobId: string }
    output: void
  }
  [IPC.JOBS_RENAME]: {
    input: RenameJobInput
    output: JobMetadata
  }
  [IPC.JOBS_RETRY]: {
    input: RetryJobInput
    output: JobMetadata
  }
  [IPC.JOBS_DOWNLOAD]: {
    input: DownloadInput
    output: { filePath: string; fileName: string }
  }
  [IPC.JOBS_PARTIAL_TRANSCRIPT]: {
    input: { jobId: string }
    output: { segments: { start: number; end: number; text: string }[]; text: string }
  }
  [IPC.JOBS_DELETE_MEDIA]: {
    input: { jobId: string; kind: 'original' | 'extracted' }
    output: void
  }
  [IPC.MODELS_LIST]: {
    input: void
    output: { models: ModelInfo[]; default: string }
  }
  [IPC.MODELS_SET_DEFAULT]: {
    input: { name: string }
    output: void
  }
  [IPC.MODELS_DOWNLOAD]: {
    input: { name: string }
    output: void
  }
  [IPC.MODELS_CANCEL_DOWNLOAD]: {
    input: { name: string }
    output: void
  }
  [IPC.MODELS_DELETE]: {
    input: { name: string }
    output: void
  }
  [IPC.MODELS_STATUS]: {
    input: { name: string }
    output: { status: string; sizeMb?: number; progressMb?: number }
  }
  [IPC.SETTINGS_GET]: {
    input: void
    output: WhisperSettings
  }
  [IPC.SETTINGS_UPDATE]: {
    input: WhisperSettings
    output: WhisperSettings
  }
  [IPC.SETTINGS_RESET]: {
    input: void
    output: WhisperSettings
  }
  [IPC.APP_HEALTH]: {
    input: void
    output: { status: string; whisperAvailable: boolean; ffmpegAvailable: boolean }
  }
  [IPC.APP_SELECT_FILES]: {
    input: void
    output: string[]
  }
  [IPC.APP_REVEAL_FILE]: {
    input: { filePath: string }
    output: void
  }
  [IPC.APP_SAVE_FILE]: {
    input: { sourcePath: string; defaultName: string }
    output: { saved: boolean }
  }
  [IPC.APP_GET_MEDIA_PORT]: {
    input: void
    // Port of the loopback HTTP server serving job media for <video>/<audio> playback
    output: { port: number }
  }
  [IPC.JOBS_GET_FILE_CONTENT]: {
    input: { jobId: string; format: string }
    output: { content: string }
  }
  [IPC.FOLDERS_LIST]: {
    input: void
    // jobCounts: direct (non-recursive) job count per folder id — used to badge folder tiles
    output: { folders: Folder[]; jobCounts: Record<string, number> }
  }
  [IPC.FOLDERS_CREATE]: {
    input: CreateFolderInput
    output: Folder
  }
  [IPC.FOLDERS_RENAME]: {
    input: RenameFolderInput
    output: Folder
  }
  [IPC.FOLDERS_DELETE]: {
    input: DeleteFolderInput
    output: void
  }
  [IPC.JOBS_MOVE_TO_FOLDER]: {
    input: MoveJobToFolderInput
    output: JobMetadata
  }
  // Push events — no invoke, only on()
  [IPC.JOB_PROGRESS]: {
    input: never
    output: JobProgressEvent
  }
  [IPC.JOB_COMPLETED]: {
    input: never
    output: JobCompletedEvent
  }
  [IPC.JOB_FAILED]: {
    input: never
    output: JobFailedEvent
  }
}
