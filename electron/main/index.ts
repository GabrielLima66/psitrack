import { app, BrowserWindow, powerMonitor, shell } from 'electron'
import { join } from 'node:path'
import { registerAnotacoesHandlers } from './ipc/anotacoes'
import { registerAppHandlers } from './ipc/app'
import { registerEvolucaoHandlers } from './ipc/evolucao'
import { registerPacientesHandlers } from './ipc/pacientes'
import { registerVaultHandlers } from './ipc/vault'
import { KeySession } from './crypto/session'
import { startAutoLock } from './crypto/idle-lock'

const session = new KeySession()

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
  registerVaultHandlers(session)
  registerPacientesHandlers()
  registerEvolucaoHandlers()
  registerAnotacoesHandlers()
  createWindow()

  // Poll de ociosidade do SO inteiro (CLAUDE.md invariante #6: 5 min sem
  // teclado/mouse), não listener de evento no renderer — mantém o zeramento
  // da DEK inteiramente dentro do main (electron/main/crypto/idle-lock.ts).
  startAutoLock({
    getIdleSeconds: () => powerMonitor.getSystemIdleTime(),
    onLock: () => {
      session.lock()
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('vault:locked')
      }
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
