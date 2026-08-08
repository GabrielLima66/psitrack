import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { PsiTrackDatabase } from '../db/connection'
import { readSchemaVersion, runMigrations } from '../db/migrate'
import { criarSnapshotVerificado } from './snapshot'
import { getSchemaVersion } from './verify'

export interface MigrarComSegurancaOptions {
  db: PsiTrackDatabase
  dek: Buffer
  migrationsFolder: string
  backupDir: string
  /** Pasta de anexos real da instalação — o snapshot de segurança passa a incluir os blobs também (SPEC-fase-3.md §4). */
  anexosDir: string
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
export function migrarComSeguranca({ db, dek, migrationsFolder, backupDir, anexosDir }: MigrarComSegurancaOptions): void {
  const versaoAlvo = readSchemaVersion(migrationsFolder)

  if (!isDatabaseVazio(db)) {
    const versaoAtual = getSchemaVersion(db.$client)
    if (versaoAtual < versaoAlvo) {
      mkdirSync(backupDir, { recursive: true })
      const timestamp = Date.now()
      const snapshotPath = join(backupDir, `pre-migration-v${versaoAlvo}-${timestamp}.db`)
      const blobsDestDir = join(backupDir, `pre-migration-v${versaoAlvo}-${timestamp}-anexos`)

      const { verification } = criarSnapshotVerificado({ db, dek, destPath: snapshotPath, anexosDir, blobsDestDir })
      if (!verification.ok) {
        throw new Error(
          `Snapshot de segurança pré-migração falhou na verificação (${snapshotPath}). Migração abortada, banco original intacto.`
        )
      }
    }
  }

  runMigrations(db, migrationsFolder)
}
