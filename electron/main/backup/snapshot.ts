import { existsSync, renameSync, rmSync } from 'node:fs'
import type { PsiTrackDatabase } from '../db/connection'
import { copiarBlobs, listarBlobsParaManifesto, type BlobManifestEntry } from './blobs'
import { getRowCounts, verifySnapshot, type VerificationResult } from './verify'

/**
 * `VACUUM INTO` já produz um arquivo cifrado com a mesma chave da conexão
 * de origem (CLAUDE.md: "sai já cifrado e consistente com o banco em uso").
 * Escreve em `.tmp` e faz rename atômico — nunca escreve direto no destino
 * final, pra nunca deixar um snapshot pela metade com nome de um bom.
 */
export function createSnapshot(db: PsiTrackDatabase, destPath: string): void {
  const tmpPath = `${destPath}.tmp`
  if (existsSync(tmpPath)) {
    rmSync(tmpPath) // sobra de uma tentativa anterior interrompida
  }
  // VACUUM INTO falha se o arquivo de destino já existir — por isso sempre
  // via .tmp novo, nunca sobrescrevendo destPath diretamente.
  db.$client.prepare('VACUUM INTO ?').run(tmpPath)
  renameSync(tmpPath, destPath)
}

export interface CriarSnapshotVerificadoOptions {
  db: PsiTrackDatabase
  dek: Buffer
  destPath: string
  anexosDir: string
  blobsDestDir: string
}

export interface SnapshotVerificado {
  blobEntries: BlobManifestEntry[]
  verification: VerificationResult
}

/**
 * Sequência comum a backup manual e ao snapshot de segurança pré-migração:
 * snapshot -> copia blobs -> verifica (integridade + cifra + contagem de
 * linhas + blobs). Quem chama decide o que fazer com o resultado — gravar
 * manifest e copiar keys.json (backup.ts), ou só abortar a migração
 * (pre-migration.ts).
 */
export function criarSnapshotVerificado(options: CriarSnapshotVerificadoOptions): SnapshotVerificado {
  const { db, dek, destPath, anexosDir, blobsDestDir } = options

  const sourceRowCounts = getRowCounts(db.$client)
  createSnapshot(db, destPath)

  const blobEntries = listarBlobsParaManifesto(db)
  copiarBlobs(anexosDir, blobsDestDir, blobEntries)

  const verification = verifySnapshot(destPath, dek, sourceRowCounts, { entries: blobEntries, blobsDir: blobsDestDir })

  return { blobEntries, verification }
}
