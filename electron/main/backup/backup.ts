import { copyFileSync } from 'node:fs'
import { copiarBlobs, listarBlobsParaManifesto } from './blobs'
import type { PsiTrackDatabase } from '../db/connection'
import { writeManifest, type BackupManifest } from './manifest'
import { createSnapshot } from './snapshot'
import { getRowCounts, getSchemaVersion, verifySnapshot } from './verify'

export interface RunBackupOptions {
  db: PsiTrackDatabase
  dek: Buffer
  /** Caminho final do snapshot cifrado (o `.tmp` intermediário é derivado daqui). */
  snapshotPath: string
  /** `keys.json` atual da instalação — sem ele o snapshot é um banco inabrível. */
  keysFilePath: string
  keysFileDestPath: string
  manifestPath: string
  /** Pasta de anexos real da instalação (origem dos blobs a copiar). */
  anexosDir: string
  /** Pasta de destino dos blobs deste backup — sempre obrigatória: sem isso, todo backup ficaria silenciosamente incompleto (SPEC-fase-3.md §1). */
  blobsDestDir: string
}

/**
 * Orquestra o ciclo completo: snapshot -> copia blobs -> verifica (integridade
 * + cifra + contagem de linhas batendo com a origem + blobs batendo com o
 * manifesto) -> copia o keys.json -> grava o manifest.json com o resultado,
 * sempre, falhando ou não (CLAUDE.md: "grava resultado no manifest.json").
 * Lança erro se a verificação falhar — o banco original nunca é tocado por
 * este fluxo, só o snapshot.
 */
export function runBackup(options: RunBackupOptions): BackupManifest {
  const { db, dek, snapshotPath, keysFilePath, keysFileDestPath, manifestPath, anexosDir, blobsDestDir } = options

  const sourceRowCounts = getRowCounts(db.$client)
  createSnapshot(db, snapshotPath)

  const blobEntries = listarBlobsParaManifesto(db)
  copiarBlobs(anexosDir, blobsDestDir, blobEntries)

  const verification = verifySnapshot(snapshotPath, dek, sourceRowCounts, { entries: blobEntries, blobsDir: blobsDestDir })
  copyFileSync(keysFilePath, keysFileDestPath)

  const manifest: BackupManifest = {
    createdAt: new Date().toISOString(),
    schemaVersion: getSchemaVersion(db.$client),
    verification,
    blobs: { entries: blobEntries, total: blobEntries.length }
  }
  writeManifest(manifestPath, manifest)

  if (!verification.ok) {
    throw new Error('Backup falhou na verificação — detalhes em manifest.json. O banco original não foi alterado.')
  }

  return manifest
}
