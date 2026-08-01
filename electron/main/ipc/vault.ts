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
import { runMigrations } from '../db/migrate'
import { getDbPath, getKeysFilePath, getMigrationsFolder } from '../paths'

let db: PsiTrackDatabase | null = null

function openAndMigrate(dek: Buffer): void {
  db = openDatabase({ filePath: getDbPath(), dek })
  // Idempotente num banco já atualizado (drizzle pula migration já aplicada).
  // Ainda não existe uma 2ª versão de schema pra exercitar a regra do
  // CLAUDE.md de "snapshot antes de migrar banco já existente" — quando
  // houver, o backup precisa entrar aqui antes do runMigrations.
  runMigrations(db, getMigrationsFolder())
}

export type VaultResult<T extends object = Record<string, never>> = ({ ok: true } & T) | { ok: false; error: string }

/**
 * `ipcMain.handle` deixando o erro escapar via `throw` não dá uma mensagem
 * limpa no renderer — o Electron embrulha em algo como
 * "Error invoking remote method 'vault:unlock': Error: Senha incorreta.".
 * Por isso os handlers abaixo capturam o erro e devolvem
 * `{ ok: false, error }` como valor normal, nunca como rejeição de promise.
 */
async function safely<T extends object>(work: () => Promise<T> | T): Promise<VaultResult<T>> {
  try {
    return { ok: true, ...(await work()) }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
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
