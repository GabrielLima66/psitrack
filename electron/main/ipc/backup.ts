import { app, ipcMain } from 'electron'
import { criarBackupManual, listarBackups, restaurarBackupComSeguranca, verificarBackup } from '../backup/gerenciador'
import { lerUltimaRestauracao } from '../backup/registroRestauracao'
import type { KeySession } from '../crypto/session'
import { getAnexosDir, getBackupsDir, getDbPath, getKeysFilePath, getMigrationsFolder } from '../paths'
import { safely } from './result'
import { closeDb, getDb } from './vault'

/** Handlers da tela de Configurações — Etapa 17 (SPEC-fase-3.md): backup manual local, listagem, verificação e restore. */
export function registerBackupHandlers(session: KeySession): void {
  ipcMain.handle('backup:listar', () => safely(() => ({ backups: listarBackups(getBackupsDir()) })))

  ipcMain.handle('backup:criar', () =>
    safely(() => ({
      backup: criarBackupManual({
        db: getDb(),
        dek: session.getDek(),
        backupDir: getBackupsDir(),
        anexosDir: getAnexosDir(),
        keysFilePath: getKeysFilePath()
      })
    }))
  )

  ipcMain.handle('backup:verificar', (_event, pasta: string) =>
    safely(() => ({ resultado: verificarBackup(getBackupsDir(), pasta, session.getDek()) }))
  )

  ipcMain.handle('backup:ultimaRestauracao', () => safely(() => ({ registro: lerUltimaRestauracao(getBackupsDir()) })))

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
