import { existsSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { utcParaDataLocal } from '../db/timezone'
import { listarSnapshotsExternos, pastaPool, pastaSnapshots, verificarSnapshotExternoPorPasta } from './destinos'
import { listarBackups, verificarBackup } from './gerenciador'

const DIAS_RETIDOS = 7
const SEMANAS_RETIDAS = 4
const MESES_RETIDOS = 6

export interface ItemRetencao {
  identificador: string
  createdAt: string // ISO UTC
}

export interface DecisaoRetencao {
  manter: string[]
  purgar: string[]
}

function chaveDia(createdAt: string): string {
  return utcParaDataLocal(createdAt) // 'YYYY-MM-DD' em America/Sao_Paulo
}

function chaveMes(createdAt: string): string {
  return chaveDia(createdAt).slice(0, 7) // 'YYYY-MM'
}

/** Bucket determinístico de 7 dias (dias-desde-a-época ÷ 7) — não precisa ser o número de semana ISO calendário-correto, só precisa agrupar de forma estável pra "4 semanas distintas" fazer sentido. */
function chaveSemana(createdAt: string): number {
  const [ano, mes, dia] = chaveDia(createdAt).split('-').map(Number)
  const diaIndice = Math.floor(Date.UTC(ano, mes - 1, dia) / 86_400_000)
  return Math.floor(diaIndice / 7)
}

/**
 * GFS (D39): 7 diários + 4 semanais + 6 mensais. Cada item entra numa
 * camada só — dentro de uma camada, só o mais recente de cada chave
 * distinta é retido; uma segunda ocorrência da MESMA chave é descartada ali
 * mesmo (nunca passa pra próxima camada, já está coberta pela mais nova).
 * Uma chave NOVA que estoura o limite da camada é que passa adiante.
 * Nunca deixa o conjunto retido vazio.
 */
export function calcularRetencao(itens: ItemRetencao[]): DecisaoRetencao {
  const ordenados = [...itens].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const mantidos = new Set<string>()
  let restantes = ordenados

  function reterCamada(chaveDe: (item: ItemRetencao) => string | number, limite: number): void {
    const vistos = new Set<string | number>()
    const passamAdiante: ItemRetencao[] = []
    for (const item of restantes) {
      const chave = chaveDe(item)
      if (vistos.has(chave)) continue // duplicata na mesma janela desta camada — descartada
      if (vistos.size < limite) {
        vistos.add(chave)
        mantidos.add(item.identificador)
      } else {
        passamAdiante.push(item)
      }
    }
    restantes = passamAdiante
  }

  reterCamada((item) => chaveDia(item.createdAt), DIAS_RETIDOS)
  reterCamada((item) => chaveSemana(item.createdAt), SEMANAS_RETIDAS)
  reterCamada((item) => chaveMes(item.createdAt), MESES_RETIDOS)

  if (mantidos.size === 0 && ordenados.length > 0) {
    mantidos.add(ordenados[0]!.identificador)
  }

  return {
    manter: ordenados.filter((item) => mantidos.has(item.identificador)).map((item) => item.identificador),
    purgar: ordenados.filter((item) => !mantidos.has(item.identificador)).map((item) => item.identificador)
  }
}

function tamanhoDaPasta(caminho: string): number {
  if (!existsSync(caminho)) return 0
  let total = 0
  for (const entrada of readdirSync(caminho, { withFileTypes: true })) {
    const caminhoFilho = join(caminho, entrada.name)
    total += entrada.isDirectory() ? tamanhoDaPasta(caminhoFilho) : statSync(caminhoFilho).size
  }
  return total
}

/** Remove do pool qualquer blob cujo sha256 não esteja em `shasUsados` (contagem de referência recalculada na hora, nunca guardada como estado à parte — D38/D39). */
function purgarPoolOrfao(destino: string, shasUsados: Set<string>): string[] {
  const poolDir = pastaPool(destino)
  if (!existsSync(poolDir)) return []

  const purgados: string[] = []
  for (const arquivo of readdirSync(poolDir)) {
    if (!arquivo.endsWith('.enc')) continue
    const sha = arquivo.slice(0, -'.enc'.length)
    if (!shasUsados.has(sha)) {
      unlinkSync(join(poolDir, arquivo))
      purgados.push(sha)
    }
  }
  return purgados
}

export interface ResultadoPurga {
  local: DecisaoRetencao
  externo: (DecisaoRetencao & { blobsPurgadosDoPool: string[] }) | null
}

export interface ExecutarPurgaOptions {
  backupDir: string
  destino: string | null
  dek: Buffer
}

/**
 * "Purga de snapshot só após verify bem-sucedido do conjunto que fica"
 * (SPEC-fase-4.md Etapa 20): verifica TODOS os retidos (local e externo)
 * ANTES de apagar qualquer coisa — se algum falhar, lança e nada é tocado.
 * Cada exclusão é independente e usa `force:true`: uma purga anterior
 * interrompida na metade não trava a próxima (pasta já ausente não é erro).
 */
export function executarPurga(opts: ExecutarPurgaOptions): ResultadoPurga {
  const backupsLocais = listarBackups(opts.backupDir)
  const itensLocais: ItemRetencao[] = backupsLocais.map((b) => ({ identificador: b.pasta, createdAt: b.manifest.createdAt }))
  const decisaoLocal = calcularRetencao(itensLocais)

  for (const pasta of decisaoLocal.manter) {
    const resultado = verificarBackup(opts.backupDir, pasta, opts.dek)
    if (!resultado.ok) {
      throw new Error(`Purga cancelada: backup local retido "${pasta}" falhou na verificação.`)
    }
  }

  let itensExternos: { pasta: string; entries: { sha256Cifrado: string }[] }[] = []
  let decisaoExterna: DecisaoRetencao | null = null

  if (opts.destino) {
    const snapshotsExternos = listarSnapshotsExternos(opts.destino)
    const itensRetencaoExterna: ItemRetencao[] = snapshotsExternos.map((s) => ({
      identificador: s.pasta,
      createdAt: s.manifest.createdAt
    }))
    decisaoExterna = calcularRetencao(itensRetencaoExterna)
    itensExternos = snapshotsExternos.map((s) => ({ pasta: s.pasta, entries: s.manifest.blobs.entries }))

    for (const pasta of decisaoExterna.manter) {
      const resultado = verificarSnapshotExternoPorPasta(opts.destino, pasta, opts.dek)
      if (!resultado.ok) {
        throw new Error(`Purga cancelada: snapshot externo retido "${pasta}" falhou na verificação.`)
      }
    }
  }

  // Só apaga depois de TODA a verificação acima ter passado.
  for (const pasta of decisaoLocal.purgar) {
    rmSync(join(opts.backupDir, pasta), { recursive: true, force: true })
  }

  if (!opts.destino || !decisaoExterna) {
    return { local: decisaoLocal, externo: null }
  }

  for (const pasta of decisaoExterna.purgar) {
    rmSync(join(pastaSnapshots(opts.destino), pasta), { recursive: true, force: true })
  }

  const shasUsados = new Set<string>()
  for (const pasta of decisaoExterna.manter) {
    const item = itensExternos.find((i) => i.pasta === pasta)
    for (const entry of item?.entries ?? []) shasUsados.add(entry.sha256Cifrado)
  }
  const blobsPurgadosDoPool = purgarPoolOrfao(opts.destino, shasUsados)

  return { local: decisaoLocal, externo: { ...decisaoExterna, blobsPurgadosDoPool } }
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

/** Dry-run pra UI: mesma decisão de `calcularRetencao`, sem apagar nada — só soma bytes. */
export function previewPurga(backupDir: string, destino: string | null): PreviewPurga {
  const backupsLocais = listarBackups(backupDir)
  const itensLocais: ItemRetencao[] = backupsLocais.map((b) => ({ identificador: b.pasta, createdAt: b.manifest.createdAt }))
  const decisaoLocal = calcularRetencao(itensLocais)
  const local: PreviewCamada = {
    totalBytes: backupsLocais.reduce((soma, b) => soma + tamanhoDaPasta(join(backupDir, b.pasta)), 0),
    aLiberarBytes: decisaoLocal.purgar.reduce((soma, pasta) => soma + tamanhoDaPasta(join(backupDir, pasta)), 0),
    mantidos: decisaoLocal.manter.length,
    purgar: decisaoLocal.purgar.length
  }

  if (!destino) return { local, externo: null }

  const snapshotsExternos = listarSnapshotsExternos(destino)
  const itensExternos: ItemRetencao[] = snapshotsExternos.map((s) => ({ identificador: s.pasta, createdAt: s.manifest.createdAt }))
  const decisaoExterna = calcularRetencao(itensExternos)
  const snapshotsDir = pastaSnapshots(destino)
  const poolDir = pastaPool(destino)

  const shasUsadosSePurgarAgora = new Set<string>()
  for (const pasta of decisaoExterna.manter) {
    const snap = snapshotsExternos.find((s) => s.pasta === pasta)
    for (const entry of snap?.manifest.blobs.entries ?? []) shasUsadosSePurgarAgora.add(entry.sha256Cifrado)
  }

  const poolTotalBytes = tamanhoDaPasta(poolDir)
  let poolALiberarBytes = 0
  if (existsSync(poolDir)) {
    for (const arquivo of readdirSync(poolDir)) {
      if (!arquivo.endsWith('.enc')) continue
      const sha = arquivo.slice(0, -'.enc'.length)
      if (!shasUsadosSePurgarAgora.has(sha)) poolALiberarBytes += statSync(join(poolDir, arquivo)).size
    }
  }

  const externo = {
    totalBytes: snapshotsExternos.reduce((soma, s) => soma + tamanhoDaPasta(join(snapshotsDir, s.pasta)), 0),
    aLiberarBytes: decisaoExterna.purgar.reduce((soma, pasta) => soma + tamanhoDaPasta(join(snapshotsDir, pasta)), 0),
    mantidos: decisaoExterna.manter.length,
    purgar: decisaoExterna.purgar.length,
    poolTotalBytes,
    poolALiberarBytes
  }

  return { local, externo }
}
