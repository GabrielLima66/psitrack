import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { PsiTrackDatabase } from '../db/connection'
import { readSchemaVersion, runMigrations } from '../db/migrate'
import { createSnapshot } from './snapshot'
import { getRowCounts, getSchemaVersion, verifySnapshot } from './verify'

export interface MigrarComSegurancaOptions {
  db: PsiTrackDatabase
  dek: Buffer
  migrationsFolder: string
  backupDir: string
}

function isDatabaseVazio(db: PsiTrackDatabase): boolean {
  const row = db.$client
    .prepare(`SELECT count(*) as count FROM sqlite_master WHERE type = 'table'`)
    .get() as { count: number }
  return row.count === 0
}

/**
 * Banco vazio (primeiro acesso) não gera snapshot — não há o que proteger.
 * Banco existente com migration pendente: snapshot + verify ANTES do
 * primeiro DDL (CLAUDE.md, seção Backup: "Migração só roda depois de
 * snapshot bem-sucedido"). Se a verificação falhar — ou o próprio snapshot
 * falhar (disco cheio, por exemplo) — a exceção sobe e `runMigrations`
 * nunca é chamado: o banco original fica intocado.
 */
export function migrarComSeguranca({ db, dek, migrationsFolder, backupDir }: MigrarComSegurancaOptions): void {
  const versaoAlvo = readSchemaVersion(migrationsFolder)

  if (!isDatabaseVazio(db)) {
    const versaoAtual = getSchemaVersion(db.$client)
    if (versaoAtual < versaoAlvo) {
      mkdirSync(backupDir, { recursive: true })
      const sourceRowCounts = getRowCounts(db.$client)
      const snapshotPath = join(backupDir, `pre-migration-v${versaoAlvo}-${Date.now()}.db`)

      createSnapshot(db, snapshotPath)
      const verification = verifySnapshot(snapshotPath, dek, sourceRowCounts)
      if (!verification.ok) {
        throw new Error(
          `Snapshot de segurança pré-migração falhou na verificação (${snapshotPath}). Migração abortada, banco original intacto.`
        )
      }
    }
  }

  runMigrations(db, migrationsFolder)
}
