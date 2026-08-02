import Database from 'better-sqlite3-multiple-ciphers'
import { verificarBlobs, type BlobManifestEntry } from './blobs'

function listTables(sqlite: Database.Database): string[] {
  const rows = sqlite
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all() as Array<{ name: string }>
  return rows.map((row) => row.name)
}

/** Contagem de linhas de toda tabela de usuário — genérico, não hardcoded por schema. */
export function getRowCounts(sqlite: Database.Database): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const table of listTables(sqlite)) {
    const row = sqlite.prepare(`SELECT count(*) as count FROM "${table}"`).get() as { count: number }
    counts[table] = row.count
  }
  return counts
}

export function getSchemaVersion(sqlite: Database.Database): number {
  return sqlite.pragma('user_version', { simple: true }) as number
}

function rowCountsEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}

export interface VerificationResult {
  ok: boolean
  integrityCheck: string
  cipherIntegrityCheckOk: boolean
  rowCounts: Record<string, number>
  rowCountsMatchSource: boolean
  blobs: { ok: boolean; problemas: string[] }
}

/**
 * Dois níveis de checagem, de propósito: `integrity_check` valida a
 * estrutura lógica do SQLite já decifrada; `cipher_integrity_check` valida
 * o HMAC por página do SQLCipher e pega corrupção na camada de cifra que o
 * primeiro não enxerga. `blobCheck` é opcional — call sites sem anexo pra
 * conferir (ou de antes da Etapa 15) continuam funcionando sem passar nada,
 * e `blobs.ok` fica `true` por não ter o que reprovar.
 */
export function verifySnapshot(
  filePath: string,
  dek: Buffer,
  sourceRowCounts: Record<string, number>,
  blobCheck?: { entries: BlobManifestEntry[]; blobsDir: string }
): VerificationResult {
  const sqlite = new Database(filePath)
  try {
    sqlite.pragma(`key="x'${dek.toString('hex')}'"`)
    const integrityCheck = sqlite.pragma('integrity_check', { simple: true }) as string
    const cipherProblems = sqlite.pragma('cipher_integrity_check') as unknown[]
    const rowCounts = getRowCounts(sqlite)
    const rowCountsMatchSource = rowCountsEqual(rowCounts, sourceRowCounts)
    const blobs = blobCheck ? verificarBlobs(blobCheck.entries, blobCheck.blobsDir) : { ok: true, problemas: [] }

    return {
      ok: integrityCheck === 'ok' && cipherProblems.length === 0 && rowCountsMatchSource && blobs.ok,
      integrityCheck,
      cipherIntegrityCheckOk: cipherProblems.length === 0,
      rowCounts,
      rowCountsMatchSource,
      blobs
    }
  } finally {
    sqlite.close()
  }
}
