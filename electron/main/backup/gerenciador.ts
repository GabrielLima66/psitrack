import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { PsiTrackDatabase } from '../db/connection'
import { runBackup } from './backup'
import { readManifest, type BackupManifest } from './manifest'
import { gravarUltimaRestauracao } from './registroRestauracao'
import { assertRestorable, restoreBackup } from './restore'
import { verifySnapshot, type VerificationResult } from './verify'

const PREFIXO_PRE_RESTORE = 'pre-restore-'

export type OrigemBackup = 'manual' | 'pre-restore'

export interface BackupListado {
  /** Nome da subpasta dentro de `backupDir` — identificador estável usado pelas outras funções. */
  pasta: string
  origem: OrigemBackup
  /** Tamanho do `snapshot.db`, em bytes. */
  tamanhoBytes: number
  manifest: BackupManifest
}

function nomeArquivoSeguro(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function tamanhoOuZero(caminho: string): number {
  return existsSync(caminho) ? statSync(caminho).size : 0
}

interface CriarSnapshotOptions {
  db: PsiTrackDatabase
  dek: Buffer
  backupDir: string
  anexosDir: string
  keysFilePath: string
}

/**
 * Reaproveita `runBackup` (não o fluxo manual de `pre-migration.ts`) porque
 * ele já escreve `manifest.json` — é exatamente o que backup manual e
 * snapshot de segurança pré-restore precisam pra aparecer na lista
 * (diferente do snapshot pré-migração, que deliberadamente não tem manifest
 * por não ser "backup completo pra usuária").
 */
function criarSnapshotEmPasta(opts: CriarSnapshotOptions, origem: OrigemBackup): BackupListado {
  const pastaFinal = origem === 'manual' ? `backup-${nomeArquivoSeguro()}` : `${PREFIXO_PRE_RESTORE}${nomeArquivoSeguro()}`
  const pastaCompleta = join(opts.backupDir, pastaFinal)
  mkdirSync(pastaCompleta, { recursive: true })

  const snapshotPath = join(pastaCompleta, 'snapshot.db')
  const manifest = runBackup({
    db: opts.db,
    dek: opts.dek,
    snapshotPath,
    keysFilePath: opts.keysFilePath,
    keysFileDestPath: join(pastaCompleta, 'keys.json'),
    manifestPath: join(pastaCompleta, 'manifest.json'),
    anexosDir: opts.anexosDir,
    blobsDestDir: join(pastaCompleta, 'anexos')
  })

  return { pasta: pastaFinal, origem, tamanhoBytes: tamanhoOuZero(snapshotPath), manifest }
}

export function criarBackupManual(opts: CriarSnapshotOptions): BackupListado {
  return criarSnapshotEmPasta(opts, 'manual')
}

/**
 * Ignora subpasta sem `manifest.json` de propósito — é assim que os
 * snapshots pré-migração (Etapa 9) ficam de fora da lista: eles convivem na
 * mesma `backupDir`, mas nunca foram pensados como backup completo pra
 * usuária navegar/restaurar por aqui.
 */
export function listarBackups(backupDir: string): BackupListado[] {
  if (!existsSync(backupDir)) return []

  const resultado: BackupListado[] = []
  for (const entrada of readdirSync(backupDir, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue
    const pastaCompleta = join(backupDir, entrada.name)
    const manifestPath = join(pastaCompleta, 'manifest.json')
    if (!existsSync(manifestPath)) continue

    const manifest = readManifest(manifestPath)
    const origem: OrigemBackup = entrada.name.startsWith(PREFIXO_PRE_RESTORE) ? 'pre-restore' : 'manual'
    resultado.push({ pasta: entrada.name, origem, tamanhoBytes: tamanhoOuZero(join(pastaCompleta, 'snapshot.db')), manifest })
  }

  return resultado.sort((a, b) => b.manifest.createdAt.localeCompare(a.manifest.createdAt))
}

/** "Verificar" avulso (sem restaurar): reabre o snapshot já gravado e roda a mesma checagem de sempre contra o que o próprio manifesto registrou na hora do backup. */
export function verificarBackup(backupDir: string, pasta: string, dek: Buffer): VerificationResult {
  const pastaCompleta = join(backupDir, pasta)
  const manifest = readManifest(join(pastaCompleta, 'manifest.json'))
  return verifySnapshot(join(pastaCompleta, 'snapshot.db'), dek, manifest.verification.rowCounts, {
    entries: manifest.blobs.entries,
    blobsDir: join(pastaCompleta, 'anexos')
  })
}

export interface RestaurarComSegurancaOptions {
  db: PsiTrackDatabase
  dek: Buffer
  backupDir: string
  /** Pasta do backup a restaurar (valor de `BackupListado.pasta`). */
  pasta: string
  anexosDirAtual: string
  keysFilePathAtual: string
  dbPathAtual: string
  migrationsFolder: string
  /** Fecha o handle de arquivo do banco vivo — só é chamado DEPOIS do gate de versão passar, nunca antes. */
  fecharConexaoAtual: () => void
}

export interface ResultadoRestauracao {
  manifestRestaurado: BackupManifest
  /** Snapshot do estado atual tirado automaticamente antes de sobrescrever — sempre existe quando a função retorna com sucesso. */
  safetyBackup: BackupListado
}

/**
 * 1. Snapshot de segurança do estado ATUAL (usa a conexão `db` ainda viva).
 * 2. Valida o backup escolhido (gate de versão) ANTES de tocar em qualquer
 *    coisa — falha rápido sem fechar a conexão nem sobrescrever nada.
 * 3. Só então fecha a conexão viva e copia banco/keys/anexos por cima.
 * 4. Grava o registro de última restauração.
 */
export function restaurarBackupComSeguranca(opts: RestaurarComSegurancaOptions): ResultadoRestauracao {
  const safetyBackup = criarSnapshotEmPasta(
    { db: opts.db, dek: opts.dek, backupDir: opts.backupDir, anexosDir: opts.anexosDirAtual, keysFilePath: opts.keysFilePathAtual },
    'pre-restore'
  )

  const pastaBackup = join(opts.backupDir, opts.pasta)
  const manifest = readManifest(join(pastaBackup, 'manifest.json'))
  assertRestorable(manifest, opts.migrationsFolder)

  opts.fecharConexaoAtual()

  restoreBackup({
    manifest,
    snapshotPath: join(pastaBackup, 'snapshot.db'),
    keysFilePath: join(pastaBackup, 'keys.json'),
    currentMigrationsFolder: opts.migrationsFolder,
    targetDbPath: opts.dbPathAtual,
    targetKeysFilePath: opts.keysFilePathAtual,
    blobsSourceDir: join(pastaBackup, 'anexos'),
    targetAnexosDir: opts.anexosDirAtual
  })

  gravarUltimaRestauracao(opts.backupDir, { restauradoEm: new Date().toISOString(), pastaOrigem: opts.pasta })

  return { manifestRestaurado: manifest, safetyBackup }
}
