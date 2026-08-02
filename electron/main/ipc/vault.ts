import { existsSync } from 'node:fs'
import { ipcMain } from 'electron'
import {
  createKeysFile,
  readKeysFile,
  writeKeysFile,
  unwrapWithPassword,
  unwrapWithRecovery,
  rewrapKeysFile
} from '../crypto/envelope'
import { decodeRecoveryKey, encodeRecoveryKey, formatRecoveryKeyForDisplay } from '../crypto/recovery-key'
import type { KeySession } from '../crypto/session'
import { openDatabase, type PsiTrackDatabase } from '../db/connection'
import { materializarTodasRecorrencias } from '../db/repositories/sessao'
import { getBackupsDir, getDbPath, getKeysFilePath, getMigrationsFolder } from '../paths'
import { migrarComSeguranca } from '../backup/pre-migration'
import { safely } from './result'

let db: PsiTrackDatabase | null = null

/** Usado pelos handlers de outros domínios (paciente, responsável, ...) depois que o cofre foi desbloqueado. */
export function getDb(): PsiTrackDatabase {
  if (!db) throw new Error('Cofre travado: não há conexão de banco em memória.')
  return db
}

function openAndMigrate(dek: Buffer): void {
  db = openDatabase({ filePath: getDbPath(), dek })
  // migrarComSeguranca (Etapa 9) só faz snapshot+verify quando há migration
  // pendente num banco já existente — banco novo/já atualizado passa direto.
  migrarComSeguranca({ db, dek, migrationsFolder: getMigrationsFolder(), backupDir: getBackupsDir() })
  // "Materialização de 12 semanas na abertura do app" (SPEC-fase-2.md
  // Etapa 11) — idempotente, estende cada recorrência ativa sem duplicar.
  materializarTodasRecorrencias(db)
}

/** Handlers do domínio "vault": senha mestra, recovery key, auto-lock. */
export function registerVaultHandlers(session: KeySession): void {
  ipcMain.handle('vault:status', () => ({
    exists: existsSync(getKeysFilePath())
  }))

  ipcMain.handle('vault:create', (_event, password: string) =>
    safely(async () => {
      const { keysFile, dek, recoveryKey } = await createKeysFile(password)
      writeKeysFile(getKeysFilePath(), keysFile)
      openAndMigrate(dek)
      session.unlock(dek)
      return { recoveryKey: formatRecoveryKeyForDisplay(encodeRecoveryKey(recoveryKey)) }
    })
  )

  ipcMain.handle('vault:unlock', (_event, password: string) =>
    safely(async () => {
      const keysFile = readKeysFile(getKeysFilePath())
      const dek = await unwrapWithPassword(keysFile, password)
      openAndMigrate(dek)
      session.unlock(dek)
      return {}
    })
  )

  ipcMain.handle('vault:unlockWithRecovery', (_event, recoveryKeyInput: string) =>
    safely(() => {
      const keysFile = readKeysFile(getKeysFilePath())
      const recoveryKey = decodeRecoveryKey(recoveryKeyInput)
      const dek = unwrapWithRecovery(keysFile, recoveryKey)
      openAndMigrate(dek)
      session.unlock(dek)
      return {}
    })
  )

  // Chamado depois de unlockWithRecovery: usa a DEK já em sessão, não pede
  // senha antiga (a recovery key já provou a identidade).
  ipcMain.handle('vault:completeRecoverySetup', (_event, newPassword: string) =>
    safely(async () => {
      const dek = session.getDek()
      const { keysFile, recoveryKey } = await rewrapKeysFile(dek, newPassword)
      writeKeysFile(getKeysFilePath(), keysFile)
      return { recoveryKey: formatRecoveryKeyForDisplay(encodeRecoveryKey(recoveryKey)) }
    })
  )

  ipcMain.handle('vault:lock', () => {
    session.lock()
    db?.$client.close()
    db = null
  })
}
