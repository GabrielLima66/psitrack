import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { PsiTrackDatabase } from './connection'

/**
 * `migrationsFolder` é parâmetro explícito, não resolvido aqui via
 * `import.meta.url` — em dev/teste ele fica ao lado deste arquivo-fonte,
 * mas dentro do instalador empacotado o `electron/main/index.ts` provavelmente
 * precisa apontar pra um caminho diferente (recurso extra copiado pelo
 * electron-builder, não bundle do Rollup). Resolver esse caminho real fica
 * pra quando o main/index.ts for escrito — aqui é só o mecanismo.
 */
export function runMigrations(db: PsiTrackDatabase, migrationsFolder: string): void {
  migrate(db, { migrationsFolder })
}
