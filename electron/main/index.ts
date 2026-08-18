import { app, BrowserWindow, powerMonitor, shell } from 'electron'
import { join } from 'node:path'
import { dispararBackupAutomaticoSeNecessario, backupAutomaticoEmAndamento } from './backup/scheduler'
import { foiPularFechamentoSolicitado, resetarPularFechamento, saidaParaAtualizacaoFoiPermitida } from './fechamento'
import { registerAgendaHandlers } from './ipc/agenda'
import { registerAnexosHandlers } from './ipc/anexos'
import { registerAnotacoesHandlers } from './ipc/anotacoes'
import { registerAppHandlers } from './ipc/app'
import { registerBackupHandlers } from './ipc/backup'
import { registerClinicoHandlers } from './ipc/clinico'
import { registerEvolucaoHandlers } from './ipc/evolucao'
import { registerFinanceiroHandlers } from './ipc/financeiro'
import { registerMensagensHandlers } from './ipc/mensagens'
import { registerPacientesHandlers } from './ipc/pacientes'
import { getDb, registerVaultHandlers } from './ipc/vault'
import { KeySession } from './crypto/session'
import { startAutoLock } from './crypto/idle-lock'
import { getAnexosDir, getBackupsDir, getConfigPath, getKeysFilePath } from './paths'
import { registerUpdateHandlers } from './update'

const session = new KeySession()

/** Janela de reação real pra clicar "Pular" no overlay de fechamento (Etapa 21) — depois disso, o backup síncrono já começou e não tem mais como interromper. */
const JANELA_PULAR_FECHAMENTO_MS = 1000

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
  registerClinicoHandlers()
  registerEvolucaoHandlers()
  registerAnotacoesHandlers()
  registerAgendaHandlers()
  registerFinanceiroHandlers()
  registerMensagensHandlers()
  registerAnexosHandlers(session)
  registerBackupHandlers(session)
  registerUpdateHandlers(session)
  createWindow()

  // Poll de ociosidade do SO inteiro (CLAUDE.md invariante #6: 5 min sem
  // teclado/mouse), não listener de evento no renderer — mantém o zeramento
  // da DEK inteiramente dentro do main (electron/main/crypto/idle-lock.ts).
  startAutoLock({
    getIdleSeconds: () => powerMonitor.getSystemIdleTime(),
    onLock: () => {
      // Etapa 21: nunca zera a DEK enquanto um backup automático estiver
      // rodando (ele precisa dela). Não interrompe nada em andamento — só
      // adia o lock pro próximo tick do poll, que vai reavaliar sozinho.
      if (backupAutomaticoEmAndamento()) return
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

let podeSairMesmo = false

/**
 * Gatilho "ao fechar" do scheduler (D40/Etapa 21): só dispara se houve
 * escrita nesta sessão (`exigirEscritaNaSessao`) e o cofre está
 * desbloqueado. Dá ~1s de janela real pra "Pular" antes de rodar o backup
 * de verdade — depois disso é síncrono e bloqueia a thread até terminar,
 * então "Pular" nesse ponto não teria mais efeito (aceito, ver plano da
 * Etapa 21: banco de usuária única é pequeno).
 */
app.on('before-quit', (event) => {
  if (podeSairMesmo) return
  if (saidaParaAtualizacaoFoiPermitida()) return // update.ts já fez o próprio backup — deixa o quitAndInstall() seguir puro
  if (!session.isUnlocked) return // cofre já travado, nada pra fazer, deixa fechar normal

  event.preventDefault()
  resetarPularFechamento()
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('backup:antesDeFechar')
  }

  setTimeout(() => {
    if (!foiPularFechamentoSolicitado()) {
      dispararBackupAutomaticoSeNecessario({
        db: getDb(),
        dek: session.getDek(),
        backupDir: getBackupsDir(),
        anexosDir: getAnexosDir(),
        keysFilePath: getKeysFilePath(),
        configPath: getConfigPath(),
        historicoPath: join(getBackupsDir(), 'historico-automatico.json'),
        gatilho: 'fechar',
        exigirEscritaNaSessao: true,
        onResultado: (execucao) => {
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send('backup:automaticoResultado', execucao)
          }
        }
      })
    }
    podeSairMesmo = true
    app.exit(0)
  }, JANELA_PULAR_FECHAMENTO_MS)
})
