import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { registerAppHandlers } from './ipc/app'

// Nome explícito: define %APPDATA%/PsiTrack/ como diretório de userData,
// independente de como o processo foi iniciado (dev via `electron .` ou empacotado).
app.setName('PsiTrack')

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Invariante de segurança (CLAUDE.md #2): renderer nunca tem acesso a
      // Node.js direto. Toda comunicação passa por IPC tipado via preload.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Nunca abrir links externos dentro do app — não há rede, e um link em
  // conteúdo clínico colado não deve navegar a própria janela do app.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerAppHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
