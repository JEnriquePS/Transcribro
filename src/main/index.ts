import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { config } from './config'
import { initDb, getDb } from './infrastructure/db/client'
import { runMigrations } from './infrastructure/db/migrate'
import { migrateLegacyData } from './infrastructure/db/legacy-migration'
import { createCompositionRoot } from './infrastructure/composition-root'
import { registerAllHandlers } from './infrastructure/ipc/register'

let mainWindow: BrowserWindow | null = null

// Set by vite-plugin-electron in dev mode
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      // dist-electron/preload.js (same dir as main.js)
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Show only when fully rendered — avoids white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in the system browser, not inside Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // dist/index.html — one level up from dist-electron/
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return mainWindow
}

app.whenReady().then(async () => {
  // 1. Init SQLite database and run schema migrations
  initDb(config.dbPath)
  runMigrations(getDb())

  // 2. Wire concrete implementations (must be after initDb)
  const root = createCompositionRoot()

  // 3. One-time legacy data migration (filesystem JSON → SQLite)
  //    Guarded by electron-store flag — no-op after first run
  const legacyJobsDir = path.join(app.getAppPath(), '..', '..', 'data', 'jobs')
  await migrateLegacyData(legacyJobsDir, root.repo, config.jobFilesDir)

  // 4. Register all IPC handlers
  registerAllHandlers(root)

  // 5. Create window and bind it to the composition root for push events
  const win = createWindow()
  root.setMainWindow(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const newWin = createWindow()
      root.setMainWindow(newWin)
    }
  })
})

app.on('window-all-closed', () => {
  mainWindow = null
  // On macOS, keep app running until Cmd+Q — standard behavior
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
