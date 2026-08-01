import { copyFileSync } from 'node:fs'
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
}

/**
 * Orquestra o ciclo completo: snapshot -> verifica (integridade + cifra +
 * contagem de linhas batendo com a origem) -> copia o keys.json -> grava o
 * manifest.json com o resultado, sempre, falhando ou não (CLAUDE.md:
 * "grava resultado no manifest.json"). Lança erro se a verificação falhar —
 * o banco original nunca é tocado por este fluxo, só o snapshot.
 */
export function runBackup(options: RunBackupOptions): BackupManifest {
  const { db, dek, snapshotPath, keysFilePath, keysFileDestPath, manifestPath } = options

  const sourceRowCounts = getRowCounts(db.$client)
  createSnapshot(db, snapshotPath)
  const verification = verifySnapshot(snapshotPath, dek, sourceRowCounts)
  copyFileSync(keysFilePath, keysFileDestPath)

  const manifest: BackupManifest = {
    createdAt: new Date().toISOString(),
    schemaVersion: getSchemaVersion(db.$client),
    verification
  }
  writeManifest(manifestPath, manifest)

  if (!verification.ok) {
    throw new Error('Backup falhou na verificação — detalhes em manifest.json. O banco original não foi alterado.')
  }

  return manifest
}
