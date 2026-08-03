/**
 * Cópia deliberada da forma dos DTOs de electron/preload/index.ts — mesma
 * razão de sempre (ver src/features/pacientes/types.ts): a fronteira entre
 * tsconfig.web.json e tsconfig.node.json não aceita `import type` de vários
 * arquivos do preload de forma estável (TS6307).
 */

export interface BackupBlobEntry {
  id: string
  sha256Cifrado: string
  tamanhoBytes: number
}

export interface BackupVerificationResult {
  ok: boolean
  integrityCheck: string
  cipherIntegrityCheckOk: boolean
  rowCounts: Record<string, number>
  rowCountsMatchSource: boolean
  blobs: { ok: boolean; problemas: string[] }
}

export interface BackupManifestDTO {
  createdAt: string
  schemaVersion: number
  verification: BackupVerificationResult
  blobs: { entries: BackupBlobEntry[]; total: number }
}

export type OrigemBackup = 'manual' | 'pre-restore'

export interface BackupListado {
  pasta: string
  origem: OrigemBackup
  tamanhoBytes: number
  manifest: BackupManifestDTO
}

export interface RegistroRestauracao {
  restauradoEm: string
  pastaOrigem: string
}

export interface ConfigDestino {
  destinoBackupExterno: string | null
  ultimoBackupExternoEm: string | null
}

/** Retenção GFS (Etapa 20, D39): 7 diários + 4 semanais + 6 mensais. */
export interface DecisaoRetencao {
  manter: string[]
  purgar: string[]
}

export interface ResultadoPurga {
  local: DecisaoRetencao
  externo: (DecisaoRetencao & { blobsPurgadosDoPool: string[] }) | null
}

export interface PreviewCamada {
  totalBytes: number
  aLiberarBytes: number
  mantidos: number
  purgar: number
}

export interface PreviewPurga {
  local: PreviewCamada
  externo: (PreviewCamada & { poolTotalBytes: number; poolALiberarBytes: number }) | null
}
