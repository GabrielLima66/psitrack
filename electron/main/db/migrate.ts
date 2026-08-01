import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { PsiTrackDatabase } from './connection'

interface MigrationJournal {
  entries: unknown[]
}

/** Quantas migrations essa pasta representa — usado como "versão de schema" no manifest.json do backup. */
export function readSchemaVersion(migrationsFolder: string): number {
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf-8')
  ) as MigrationJournal
  return journal.entries.length
}

/**
 * `migrationsFolder` é parâmetro explícito, não resolvido aqui via
 * `import.meta.url` — em dev/teste ele fica ao lado deste arquivo-fonte,
 * mas dentro do instalador empacotado o `electron/main/index.ts` provavelmente
 * precisa apontar pra um caminho diferente (recurso extra copiado pelo
 * electron-builder, não bundle do Rollup). Resolver esse caminho real fica
 * pra quando o main/index.ts for escrito — aqui é só o mecanismo.
 *
 * Depois de migrar, grava o número de migrations aplicadas em
 * `PRAGMA user_version` — é a "versão de schema" que o manifest.json do
 * backup registra e que o restore usa pra bloquear backup mais novo que o
 * app entende (CLAUDE.md, seção Backup).
 */
export function runMigrations(db: PsiTrackDatabase, migrationsFolder: string): void {
  migrate(db, { migrationsFolder })
  db.$client.pragma(`user_version = ${readSchemaVersion(migrationsFolder)}`)
}
