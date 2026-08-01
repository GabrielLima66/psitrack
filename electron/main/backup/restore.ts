import { copyFileSync } from 'node:fs'
import { readSchemaVersion } from '../db/migrate'
import type { BackupManifest } from './manifest'

/**
 * Bloqueia restaurar um backup gerado por uma versão do app mais nova do
 * que a instalação atual entende (CLAUDE.md, seção Backup) — restaurar às
 * cegas produziria um banco com tabelas/colunas que este código não
 * conhece.
 */
export function assertRestorable(manifest: BackupManifest, currentMigrationsFolder: string): void {
  const currentSchemaVersion = readSchemaVersion(currentMigrationsFolder)
  if (manifest.schemaVersion > currentSchemaVersion) {
    throw new Error(
      `Este backup foi gerado por uma versão mais nova do PsiTrack (schema v${manifest.schemaVersion}) do que esta instalação suporta (v${currentSchemaVersion}). Atualize o app antes de restaurar.`
    )
  }
}

export interface RestoreBackupOptions {
  manifest: BackupManifest
  snapshotPath: string
  keysFilePath: string
  currentMigrationsFolder: string
  targetDbPath: string
  targetKeysFilePath: string
}

/**
 * Só a mecânica de copiar os arquivos depois do gate de versão passar —
 * decisão de UX (confirmação, snapshot de segurança do banco atual antes
 * de sobrescrever) fica pra quando a tela de restore for construída.
 */
export function restoreBackup(options: RestoreBackupOptions): void {
  assertRestorable(options.manifest, options.currentMigrationsFolder)
  copyFileSync(options.snapshotPath, options.targetDbPath)
  copyFileSync(options.keysFilePath, options.targetKeysFilePath)
}
