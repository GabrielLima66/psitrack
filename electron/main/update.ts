import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { criarBackupComDestino } from './backup/destinos'
import type { KeySession } from './crypto/session'
import { permitirSaidaParaAtualizacao } from './fechamento'
import { getDb } from './ipc/vault'
import { safely } from './ipc/result'
import { getAnexosDir, getBackupsDir, getConfigPath, getKeysFilePath } from './paths'

// Nunca baixa nem instala sozinho — só quando a usuária clica (invariante de
// segurança #7 do CLAUDE.md: nenhuma chamada de rede sem ação explícita).
// `checkForUpdates`/`downloadUpdate` só rodam de dentro dos handlers abaixo,
// nunca em `app.whenReady()` nem por `setInterval`.
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

// Registrado uma vez só (não dentro do handler) — senão cada chamada de
// `baixarEInstalarAtualizacao` empilharia mais um listener duplicado.
autoUpdater.on('download-progress', (progresso) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('app:progressoAtualizacao', Math.round(progresso.percent))
  }
})

export interface StatusAtualizacao {
  versaoAtual: string
  atualizacaoDisponivel: boolean
  versaoDisponivel: string | null
}

/** Handlers do domínio "atualização": checagem e instalação manuais, nunca automáticas. */
export function registerUpdateHandlers(session: KeySession): void {
  ipcMain.handle('app:verificarAtualizacao', () =>
    safely(async (): Promise<StatusAtualizacao> => {
      const versaoAtual = app.getVersion()
      if (!app.isPackaged) {
        return { versaoAtual, atualizacaoDisponivel: false, versaoDisponivel: null }
      }
      const resultado = await autoUpdater.checkForUpdates()
      const versaoDisponivel = resultado?.updateInfo.version ?? null
      return {
        versaoAtual,
        atualizacaoDisponivel: versaoDisponivel !== null && versaoDisponivel !== versaoAtual,
        versaoDisponivel
      }
    })
  )

  // Não espera resolver do lado do renderer, de propósito (mesmo padrão de
  // `backup:restaurar`): `quitAndInstall()` mata o processo antes da resposta
  // IPC voltar — o app fecha e reabre sozinho já na versão nova.
  ipcMain.handle('app:baixarEInstalarAtualizacao', () =>
    safely(async () => {
      // Backup de segurança ANTES de trocar o executável — mesmo raciocínio
      // de "migração só roda depois de snapshot bem-sucedido" (CLAUDE.md,
      // seção Backup). Se o backup falhar, lança e a atualização é abortada
      // aqui — nunca troca a versão instalada sem uma cópia de segurança boa.
      criarBackupComDestino({
        db: getDb(),
        dek: session.getDek(),
        backupDir: getBackupsDir(),
        anexosDir: getAnexosDir(),
        keysFilePath: getKeysFilePath(),
        configPath: getConfigPath()
      })

      await autoUpdater.downloadUpdate()

      permitirSaidaParaAtualizacao()
      autoUpdater.quitAndInstall()
      return {}
    })
  )
}
