// Type declaration for window.electronAPI exposed via contextBridge in src/preload/index.ts.
// Phase 4 will refine this with the full typed IPC channel map.
export {}

declare global {
  interface Window {
    electronAPI: {
      /**
       * Invoke a main-process IPC handler.
       * Returns the handler's result wrapped in { success, data } | { success, error }.
       */
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>

      /**
       * Subscribe to push events from the main process.
       * @returns cleanup function — call in useEffect cleanup
       */
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void
    }
  }
}
