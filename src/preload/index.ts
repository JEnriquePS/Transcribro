import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Expose a typed, minimal API to the renderer via contextBridge.
// This is the ONLY bridge between renderer (sandboxed) and main process.
// Phase 4 will add typed IPC channel constants here.
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Invoke a main-process IPC handler and return its result.
   * Wraps ipcRenderer.invoke — renderer calls this instead of importing ipcRenderer.
   */
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke(channel, ...args),

  /**
   * Subscribe to a push event from the main process.
   * Returns a cleanup function — call it from useEffect cleanup.
   */
  on: (
    channel: string,
    listener: (...args: unknown[]) => void,
  ): (() => void) => {
    const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
})
