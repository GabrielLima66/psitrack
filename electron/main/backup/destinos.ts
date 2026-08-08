import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve, sep, join } from 'node:path'
import { listarBlobsParaManifesto, verificarPresencaTamanhoHash, type BlobManifestEntry } from './blobs'
import { criarBackupManual, type BackupListado } from './gerenciador'
import { readManifest, writeManifest, type BackupManifest } from './manifest'
import { createSnapshot } from './snapshot'
import type { PsiTrackDatabase } from '../db/connection'
import { getRowCounts, getSchemaVersion, montarVerificationResult, verificarIntegridadeArquivo, type VerificationResult } from './verify'

/**
 * `config.json` — só configuração de app não-sensível (caminho de pasta,
 * timestamp). Nunca dado clínico, por isso vive em claro (CLAUDE.md, "Dados
 * em runtime" já documentava este arquivo; esta é a primeira etapa que o usa
 * de verdade).
 */
export interface AppConfig {
  destinoBackupExterno: string | null
  ultimoBackupExternoEm: string | null
}

const CONFIG_PADRAO: AppConfig = { destinoBackupExterno: null, ultimoBackupExternoEm: null }

export function lerConfig(configPath: string): AppConfig {
  if (!existsSync(configPath)) return CONFIG_PADRAO
  return { ...CONFIG_PADRAO, ...(JSON.parse(readFileSync(configPath, 'utf-8')) as Partial<AppConfig>) }
}

export function gravarConfig(configPath: string, config: AppConfig): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

/** "Configurar destino dentro do próprio userData é bloqueado" — sem isso, backup externo e local seriam a mesma cópia disfarçada de duas. */
export function validarDestino(destino: string, userDataDir: string): void {
  const destinoResolvido = resolve(destino)
  const userDataResolvido = resolve(userDataDir)
  if (destinoResolvido === userDataResolvido || destinoResolvido.startsWith(userDataResolvido + sep)) {
    throw new Error('A pasta de destino não pode ficar dentro dos dados do próprio app.')
  }
}

/** Exportada pra `retencao.ts` escanear o pool na hora de purgar blob órfão. */
export function pastaPool(destino: string): string {
  return join(destino, 'psitrack', 'blobs')
}

function caminhoNoPool(destino: string, sha256: string): string {
  return join(pastaPool(destino), `${sha256}.enc`)
}

/**
 * Pool endereçado por conteúdo (D38): copia só se o sha256 ainda não existir
 * lá — dois snapshots com o mesmo anexo (imutável por definição) referenciam
 * o mesmo arquivo em vez de duplicar. Escrita atômica (`.tmp` → rename),
 * mesmo padrão de D31.
 */
export function copiarParaPool(anexosDir: string, destino: string, entries: BlobManifestEntry[]): void {
  mkdirSync(pastaPool(destino), { recursive: true })
  for (const entrada of entries) {
    const destinoFinal = caminhoNoPool(destino, entrada.sha256Cifrado)
    if (existsSync(destinoFinal)) continue // já tem esse conteúdo no pool — dedup

    const origem = join(anexosDir, `${entrada.id}.enc`)
    if (!existsSync(origem)) {
      throw new Error(`Blob ${entrada.id} referenciado no banco, mas ausente em ${anexosDir}.`)
    }
    const tmp = `${destinoFinal}.tmp`
    copyFileSync(origem, tmp)
    renameSync(tmp, destinoFinal)
  }
}

/** Confere cada entry do manifesto contra o pool: presença, tamanho, hash — mesma checagem de `verificarBlobs`, endereçada por sha256 em vez de id. */
export function verificarPool(entries: BlobManifestEntry[], destino: string): { ok: boolean; problemas: string[] } {
  return verificarPresencaTamanhoHash(
    entries,
    (entrada) => caminhoNoPool(destino, entrada.sha256Cifrado),
    (entrada) => entrada.sha256Cifrado,
    'arquivo ausente no pool'
  )
}

function nomeArquivoSeguro(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

/** Exportada pra `retencao.ts` computar o caminho de uma pasta de snapshot específica sem duplicar a convenção. */
export function pastaSnapshots(destino: string): string {
  return join(destino, 'psitrack', 'snapshots')
}

export interface EscreverBackupExternoOptions {
  db: PsiTrackDatabase
  dek: Buffer
  destino: string
  anexosDir: string
  sourceRowCounts: Record<string, number>
  blobEntries: BlobManifestEntry[]
}

/**
 * Um snapshot externo: `{destino}/psitrack/snapshots/{timestamp}/banco.db` +
 * `manifest.json`, blobs no pool compartilhado (não dentro da pasta do
 * snapshot — é isso que evita duplicar gigabytes por retenção, D38).
 * `manifest.json` só é escrito no fim, depois de tudo verificado — se o
 * processo morrer no meio (destino desconectado), a pasta fica sem
 * manifesto e `verificarSnapshotExterno`/qualquer listagem futura a ignora,
 * exatamente como um snapshot pré-migração incompleto.
 */
export function escreverBackupExterno(opts: EscreverBackupExternoOptions): BackupManifest {
  const pastaSnapshot = join(pastaSnapshots(opts.destino), nomeArquivoSeguro())
  mkdirSync(pastaSnapshot, { recursive: true })

  const dbPath = join(pastaSnapshot, 'banco.db')
  createSnapshot(opts.db, dbPath)
  copiarParaPool(opts.anexosDir, opts.destino, opts.blobEntries)

  // Não dá pra usar `verifySnapshot` aqui: ele confere blobs via
  // `verificarBlobs`, que procura `{blobsDir}/{id}.enc` — o pool guarda
  // `{sha256}.enc`. Monta o resultado combinando a checagem de arquivo
  // (reaproveitada) com `verificarPool` (endereçada por conteúdo).
  const integridade = verificarIntegridadeArquivo(dbPath, opts.dek, opts.sourceRowCounts)
  const blobs = verificarPool(opts.blobEntries, opts.destino)
  const verification = montarVerificationResult(integridade, blobs)

  const manifest: BackupManifest = {
    createdAt: new Date().toISOString(),
    schemaVersion: getSchemaVersion(opts.db.$client),
    verification,
    blobs: { entries: opts.blobEntries, total: opts.blobEntries.length }
  }
  writeManifest(join(pastaSnapshot, 'manifest.json'), manifest)

  if (!verification.ok) {
    throw new Error('Backup externo falhou na verificação — detalhes no manifest.json do destino.')
  }

  return manifest
}

/** Todos os snapshots externos (com manifest.json), do mais novo pro mais velho — pasta incompleta (sem manifesto ainda) é ignorada, mesma regra de `listarBackups`. */
export function listarSnapshotsExternos(destino: string): { pasta: string; manifest: BackupManifest }[] {
  const dir = pastaSnapshots(destino)
  if (!existsSync(dir)) return []

  const resultado: { pasta: string; manifest: BackupManifest }[] = []
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue
    const manifestPath = join(dir, entrada.name, 'manifest.json')
    if (!existsSync(manifestPath)) continue
    resultado.push({ pasta: entrada.name, manifest: readManifest(manifestPath) })
  }
  return resultado.sort((a, b) => b.manifest.createdAt.localeCompare(a.manifest.createdAt))
}

/** Reconfere um snapshot externo específico contra o pool — usado tanto pelo "Verificar" avulso (o mais recente) quanto pela purga (todos os retidos, Etapa 20). */
export function verificarSnapshotExternoPorPasta(destino: string, pasta: string, dek: Buffer): VerificationResult {
  const manifest = readManifest(join(pastaSnapshots(destino), pasta, 'manifest.json'))
  const dbPath = join(pastaSnapshots(destino), pasta, 'banco.db')
  const integridade = verificarIntegridadeArquivo(dbPath, dek, manifest.verification.rowCounts)
  const blobs = verificarPool(manifest.blobs.entries, destino)
  return montarVerificationResult(integridade, blobs)
}

/** "Verificar" avulso do destino externo (critério de aceite da Etapa 19) — re-checa o snapshot mais recente contra o pool, sem restaurar nada. */
export function verificarSnapshotExterno(destino: string, dek: Buffer): VerificationResult | null {
  const [maisRecente] = listarSnapshotsExternos(destino)
  if (!maisRecente) return null
  return verificarSnapshotExternoPorPasta(destino, maisRecente.pasta, dek)
}

export interface CriarBackupComDestinoOptions {
  db: PsiTrackDatabase
  dek: Buffer
  backupDir: string
  anexosDir: string
  keysFilePath: string
  configPath: string
}

export interface ResultadoBackupComDestino {
  backup: BackupListado
  /** `null` = sem destino configurado; `true`/`false` = tentou e o resultado. */
  destinoOk: boolean | null
  destinoErro?: string
}

/**
 * Local sempre (via `criarBackupManual`, Etapa 17, intocado — mantém o
 * caminho de restore sem risco de regressão) + externo só se configurado.
 * Falha do destino NUNCA propaga como exceção daqui pra fora (D42: destino
 * indisponível é estado, não erro) — o backup local já está feito e válido
 * de qualquer forma.
 */
export function criarBackupComDestino(opts: CriarBackupComDestinoOptions): ResultadoBackupComDestino {
  const backup = criarBackupManual({
    db: opts.db,
    dek: opts.dek,
    backupDir: opts.backupDir,
    anexosDir: opts.anexosDir,
    keysFilePath: opts.keysFilePath
  })

  const config = lerConfig(opts.configPath)
  if (!config.destinoBackupExterno) return { backup, destinoOk: null }

  try {
    const sourceRowCounts = getRowCounts(opts.db.$client)
    const blobEntries = listarBlobsParaManifesto(opts.db)
    escreverBackupExterno({
      db: opts.db,
      dek: opts.dek,
      destino: config.destinoBackupExterno,
      anexosDir: opts.anexosDir,
      sourceRowCounts,
      blobEntries
    })
    gravarConfig(opts.configPath, { ...config, ultimoBackupExternoEm: new Date().toISOString() })
    return { backup, destinoOk: true }
  } catch (erro) {
    return { backup, destinoOk: false, destinoErro: (erro as Error).message }
  }
}
