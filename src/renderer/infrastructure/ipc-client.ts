/**
 * Typed IPC client for the renderer process.
 * Wraps window.electronAPI so no component imports ipcRenderer directly.
 * Every successful response is the raw payload; errors are thrown as IpcError.
 */
import { IPC, type IpcMap } from '../../shared/ipc-channels'

// ── Internal invoke helper ───────────────────────────────────────────────────

async function invoke<C extends keyof IpcMap>(
  channel: C,
  input?: IpcMap[C]['input'],
): Promise<IpcMap[C]['output']> {
  const response = await (window.electronAPI.invoke(channel, input) as Promise<
    { success: true; data: IpcMap[C]['output'] } | { success: false; error: { code: string; message: string } }
  >)
  if (!response.success) {
    const err = new Error(response.error.message)
    ;(err as Error & { code: string }).code = response.error.code
    throw err
  }
  return response.data
}

// ── Subscribe to push events ─────────────────────────────────────────────────

function on<C extends keyof IpcMap>(
  channel: C,
  listener: (payload: IpcMap[C]['output']) => void,
): () => void {
  return window.electronAPI.on(channel, listener as (...args: unknown[]) => void)
}

// ── Public API ────────────────────────────────────────────────────────────────

export const ipc = {
  // Jobs
  createJob: (filePath: string, config: IpcMap[typeof IPC.JOBS_CREATE]['input']['config']) =>
    invoke(IPC.JOBS_CREATE, { filePath, config }),

  createBatch: (filePaths: string[], config: IpcMap[typeof IPC.JOBS_CREATE_BATCH]['input']['config']) =>
    invoke(IPC.JOBS_CREATE_BATCH, { filePaths, config }),

  listJobs: (limit = 100, offset = 0) =>
    invoke(IPC.JOBS_LIST, { limit, offset }),

  getJob: (jobId: string) =>
    invoke(IPC.JOBS_GET, { jobId }),

  deleteJob: (jobId: string) =>
    invoke(IPC.JOBS_DELETE, { jobId }),

  renameJob: (jobId: string, displayName: string) =>
    invoke(IPC.JOBS_RENAME, { jobId, displayName }),

  retryJob: (jobId: string, resume: boolean) =>
    invoke(IPC.JOBS_RETRY, { jobId, resume }),

  downloadFile: (jobId: string, format: string) =>
    invoke(IPC.JOBS_DOWNLOAD, { jobId, format: format as IpcMap[typeof IPC.JOBS_DOWNLOAD]['input']['format'] }),

  getFileContent: (jobId: string, format: string) =>
    invoke(IPC.JOBS_GET_FILE_CONTENT, { jobId, format }),

  getPartialTranscript: (jobId: string) =>
    invoke(IPC.JOBS_PARTIAL_TRANSCRIPT, { jobId }),

  // Models
  listModels: () =>
    invoke(IPC.MODELS_LIST),

  setDefaultModel: (name: string) =>
    invoke(IPC.MODELS_SET_DEFAULT, { name }),

  downloadModel: (name: string) =>
    invoke(IPC.MODELS_DOWNLOAD, { name }),

  cancelDownload: (name: string) =>
    invoke(IPC.MODELS_CANCEL_DOWNLOAD, { name }),

  deleteModel: (name: string) =>
    invoke(IPC.MODELS_DELETE, { name }),

  getModelStatus: (name: string) =>
    invoke(IPC.MODELS_STATUS, { name }),

  // App
  selectFiles: () =>
    invoke(IPC.APP_SELECT_FILES),

  revealFile: (filePath: string) =>
    invoke(IPC.APP_REVEAL_FILE, { filePath }),

  // Push event subscriptions
  onJobProgress: (listener: (e: IpcMap[typeof IPC.JOB_PROGRESS]['output']) => void) =>
    on(IPC.JOB_PROGRESS, listener),

  onJobCompleted: (listener: (e: IpcMap[typeof IPC.JOB_COMPLETED]['output']) => void) =>
    on(IPC.JOB_COMPLETED, listener),

  onJobFailed: (listener: (e: IpcMap[typeof IPC.JOB_FAILED]['output']) => void) =>
    on(IPC.JOB_FAILED, listener),
} as const
