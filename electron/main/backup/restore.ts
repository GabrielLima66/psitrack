import { copyFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { readSchemaVersion } from '../db/migrate'
import { verificarBlobs } from './blobs'
import type { BackupManifest } from './manifest'

/**
 * Bloqueia restaurar um backup gerado por uma versão do app mais nova do
 * que a instalação atual entende (CLAUDE.md, seção Backup) — restaurar às
 * cegas produziria um banco com tabelas/colunas que este código não
 * conhece.
 */
export function assertRestorable(manifest: BackupManifest, currentMigrationsFolder: string): void {
  const currentSchemaVersion = readSchemaVersion(currentMigrationsFolder)
  if (manifest.schemaVersion > currentSchemaVersion) {
    throw new Error(
      `Este backup foi gerado por uma versão mais nova do PsiTrack (schema v${manifest.schemaVersion}) do que esta instalação suporta (v${currentSchemaVersion}). Atualize o app antes de restaurar.`
    )
  }
}

export interface RestoreBackupOptions {
  manifest: BackupManifest
  snapshotPath: string
  keysFilePath: string
  currentMigrationsFolder: string
  targetDbPath: string
  targetKeysFilePath: string
  /** Pasta de blobs DENTRO do snapshot (gerada por `runBackup`/`migrarComSeguranca`). */
  blobsSourceDir: string
  /** Pasta de anexos real de destino — normalmente `getAnexosDir()` da instalação atual. */
  targetAnexosDir: string
}

/**
 * Gate de versão + blobs batendo com o manifesto ANTES de copiar qualquer
 * coisa — um snapshot com blob ausente/corrompido é recusado inteiro, sem
 * tocar no estado atual (mesmo raciocínio do gate de versão: checagem
 * sempre antes do primeiro `copyFileSync`). Decisão de UX (confirmação,
 * snapshot de segurança do estado atual antes de sobrescrever) fica pra
 * quando a tela de restore for construída (Etapa 17).
 */
export function restoreBackup(options: RestoreBackupOptions): void {
  assertRestorable(options.manifest, options.currentMigrationsFolder)

  const verificacaoBlobs = verificarBlobs(options.manifest.blobs.entries, options.blobsSourceDir)
  if (!verificacaoBlobs.ok) {
    throw new Error(`Blobs do snapshot não batem com o manifesto, restauração recusada: ${verificacaoBlobs.problemas.join('; ')}`)
  }

  copyFileSync(options.snapshotPath, options.targetDbPath)
  copyFileSync(options.keysFilePath, options.targetKeysFilePath)

  mkdirSync(options.targetAnexosDir, { recursive: true })
  for (const entrada of options.manifest.blobs.entries) {
    copyFileSync(join(options.blobsSourceDir, `${entrada.id}.enc`), join(options.targetAnexosDir, `${entrada.id}.enc`))
  }
}
