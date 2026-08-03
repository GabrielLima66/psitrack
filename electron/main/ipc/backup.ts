import { app, BrowserWindow, ipcMain } from 'electron'
import { escolherPastaDestino } from '../anexos/dialogos'
import { criarBackupComDestino, gravarConfig, lerConfig, validarDestino, verificarSnapshotExterno } from '../backup/destinos'
import { listarBackups, restaurarBackupComSeguranca, verificarBackup } from '../backup/gerenciador'
import { lerUltimaRestauracao } from '../backup/registroRestauracao'
import { executarPurga, previewPurga } from '../backup/retencao'
import type { KeySession } from '../crypto/session'
import { getAnexosDir, getBackupsDir, getConfigPath, getDbPath, getKeysFilePath, getMigrationsFolder } from '../paths'
import { safely } from './result'
import { closeDb, getDb } from './vault'

/** Handlers da tela de Configurações — Etapas 17-19 (SPEC-fase-3.md/SPEC-fase-4.md): backup manual local + destino externo, listagem, verificação e restore. */
export function registerBackupHandlers(session: KeySession): void {
  ipcMain.handle('backup:listar', () => safely(() => ({ backups: listarBackups(getBackupsDir()) })))

  // Local sempre + externo quando configurado (D42: destino indisponível é
  // estado — `destinoOk` reflete isso pra UI, nunca vira erro bloqueante).
  ipcMain.handle('backup:criar', () =>
    safely(() => {
      const resultado = criarBackupComDestino({
        db: getDb(),
        dek: session.getDek(),
        backupDir: getBackupsDir(),
        anexosDir: getAnexosDir(),
        keysFilePath: getKeysFilePath(),
        configPath: getConfigPath()
      })
      return resultado
    })
  )

  ipcMain.handle('backup:obterConfigDestino', () => safely(() => lerConfig(getConfigPath())))

  ipcMain.handle('backup:configurarDestino', (event) =>
    safely(async () => {
      const janela = BrowserWindow.fromWebContents(event.sender)
      const pasta = await escolherPastaDestino(janela)
      if (!pasta) return { cancelado: true as const, destino: null }

      validarDestino(pasta, app.getPath('userData'))
      const config = lerConfig(getConfigPath())
      gravarConfig(getConfigPath(), { ...config, destinoBackupExterno: pasta })
      return { cancelado: false as const, destino: pasta }
    })
  )

  ipcMain.handle('backup:removerDestino', () =>
    safely(() => {
      const config = lerConfig(getConfigPath())
      gravarConfig(getConfigPath(), { ...config, destinoBackupExterno: null })
      return {}
    })
  )

  ipcMain.handle('backup:verificarDestino', () =>
    safely(() => {
      const config = lerConfig(getConfigPath())
      if (!config.destinoBackupExterno) return { resultado: null }
      return { resultado: verificarSnapshotExterno(config.destinoBackupExterno, session.getDek()) }
    })
  )

  ipcMain.handle('backup:verificar', (_event, pasta: string) =>
    safely(() => ({ resultado: verificarBackup(getBackupsDir(), pasta, session.getDek()) }))
  )

  ipcMain.handle('backup:ultimaRestauracao', () => safely(() => ({ registro: lerUltimaRestauracao(getBackupsDir()) })))

  ipcMain.handle('backup:previewPurga', () =>
    safely(() => ({ preview: previewPurga(getBackupsDir(), lerConfig(getConfigPath()).destinoBackupExterno) }))
  )

  ipcMain.handle('backup:executarPurga', () =>
    safely(() => ({
      resultado: executarPurga({
        backupDir: getBackupsDir(),
        destino: lerConfig(getConfigPath()).destinoBackupExterno,
        dek: session.getDek()
      })
    }))
  )

  // Depois de restaurar com sucesso, o app fecha e reabre sozinho — todo
  // estado em memória (stores do renderer, sessão, conexão de banco) parte
  // de um boot limpo em cima do banco trocado, sem tentar reconciliar nada
  // ao vivo. A promise nunca chega a resolver do lado do renderer (o
  // processo morre antes) — de propósito, ver ConfiguracoesScreen.
  ipcMain.handle('backup:restaurar', (_event, pasta: string) =>
    safely(() => {
      restaurarBackupComSeguranca({
        db: getDb(),
        dek: session.getDek(),
        backupDir: getBackupsDir(),
        pasta,
        anexosDirAtual: getAnexosDir(),
        keysFilePathAtual: getKeysFilePath(),
        dbPathAtual: getDbPath(),
        migrationsFolder: getMigrationsFolder(),
        fecharConexaoAtual: closeDb
      })
      session.lock()
      app.relaunch()
      app.exit(0)
      return {}
    })
  )
}
