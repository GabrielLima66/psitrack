import Database from 'better-sqlite3-multiple-ciphers'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

// `drizzle-orm/better-sqlite3`'s driver.js faz `import Client from
// 'better-sqlite3'` no topo do módulo incondicionalmente (side effect de
// import estático, roda mesmo no branch em que passamos um client já
// pronto). Sem o pacote real 'better-sqlite3' instalado, isso quebra em
// runtime com "Cannot find package 'better-sqlite3'" mesmo sem nunca
// instanciá-lo. Solução: package.json aliasa 'better-sqlite3' pro próprio
// tarball de 'better-sqlite3-multiple-ciphers' (mesmo código, dois nomes de
// pacote) — não é uma segunda dependência de verdade, só satisfaz essa
// import estática da lib. O `new Database(...)` abaixo continua usando o
// nome real do pacote.

export interface OpenDatabaseOptions {
  filePath: string
  dek: Buffer
}

export type PsiTrackDatabase = ReturnType<typeof drizzle<typeof schema>>

/**
 * Abre o banco cifrado e devolve o handle Drizzle já com o schema. A DEK
 * vira string hex só neste ponto exato, no menor escopo possível — não dá
 * pra zerar de verdade a heap de uma string do V8, limitação conhecida e
 * aceita (documentada também no HANDOFF.md).
 *
 * `PRAGMA key` sozinho nunca falha, mesmo com a chave errada — o SQLCipher
 * só valida a chave na primeira leitura real de página. Por isso força essa
 * leitura aqui (`sqlite_master`) pra falhar cedo, com erro claro, em vez de
 * devolver um handle que quebra de forma confusa no primeiro SELECT da
 * aplicação.
 */
export function openDatabase({ filePath, dek }: OpenDatabaseOptions): PsiTrackDatabase {
  const sqlite = new Database(filePath)
  const dekHex = dek.toString('hex')
  sqlite.pragma(`key="x'${dekHex}'"`)

  try {
    sqlite.prepare('SELECT count(*) FROM sqlite_master').get()
  } catch {
    sqlite.close()
    throw new Error('Não foi possível abrir o banco: chave incorreta ou arquivo corrompido.')
  }

  return drizzle(sqlite, { schema })
}
