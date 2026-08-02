import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { and, desc, eq, isNotNull, isNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import type { PsiTrackDatabase } from '../db/connection'
import { anexo } from '../db/schema'
import { uuidv7 } from '../db/uuidv7'
import { cifrarArquivo, decifrarArquivo } from './anexoCripto'

const LIMITE_TAMANHO_BYTES = 25 * 1024 * 1024 // D30
const ORFAO_IDADE_MINIMA_MS = 24 * 60 * 60 * 1000 // D31 — só remove blob sem linha depois de 24h

const CLASSIFICACAO_VALUES = ['prontuario', 'privado'] as const

export const salvarAnexoInputSchema = z
  .object({
    pacienteId: z.string().min(1),
    evolucaoId: z.string().min(1).nullish(),
    classificacao: z.enum(CLASSIFICACAO_VALUES),
    nomeOriginal: z.string().trim().min(1, 'Nome do arquivo é obrigatório.'),
    mime: z.string().trim().min(1),
    descricao: z.string().trim().min(1).nullish()
  })
  // D33: anexo pendurado em evolução é documento clínico por definição.
  .refine((v) => !v.evolucaoId || v.classificacao === 'prontuario', {
    message: 'Anexo vinculado a uma evolução tem que ser classificado como prontuário.',
    path: ['classificacao']
  })
export type SalvarAnexoInput = z.input<typeof salvarAnexoInputSchema>

export type Anexo = typeof anexo.$inferSelect

export function obterAnexoOuFalhar(db: PsiTrackDatabase, id: string): Anexo {
  const row = db.select().from(anexo).where(eq(anexo.id, id)).get()
  if (!row) throw new Error('Anexo não encontrado.')
  return row
}

export interface ListarAnexosOptions {
  /** `true` = só a lixeira (soft-deletados); default/false = só os ativos. */
  lixeira?: boolean
}

export function listarAnexosPaciente(db: PsiTrackDatabase, pacienteId: string, options: ListarAnexosOptions = {}): Anexo[] {
  const condicaoDeletado = options.lixeira ? isNotNull(anexo.deletedAt) : isNull(anexo.deletedAt)
  return db
    .select()
    .from(anexo)
    .where(and(eq(anexo.pacienteId, pacienteId), condicaoDeletado))
    .orderBy(desc(anexo.createdAt))
    .all()
}

/** Soft delete — o blob nunca é apagado aqui (D32): só a purga, comando explícito, remove o arquivo. */
export function excluirAnexo(db: PsiTrackDatabase, id: string): void {
  obterAnexoOuFalhar(db, id)
  db.update(anexo)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(anexo.id, id))
    .run()
}

export function restaurarAnexo(db: PsiTrackDatabase, id: string): void {
  obterAnexoOuFalhar(db, id)
  db.update(anexo).set({ deletedAt: null, updatedAt: new Date().toISOString() }).where(eq(anexo.id, id)).run()
}

function caminhoBlob(anexosDir: string, id: string): string {
  return join(anexosDir, `${id}.enc`)
}

/** Grava com fsync de verdade antes do rename (D31) — `writeFileSync` sozinho não garante que os bytes saíram do cache do SO. */
function escreverComFsync(caminho: string, dados: Buffer): void {
  const fd = openSync(caminho, 'w')
  try {
    writeSync(fd, dados)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}

/**
 * Escrita atômica (D31): `<uuid>.enc.tmp` → fsync → rename → insert. Se o
 * processo morrer entre o rename e o insert, sobra um blob sem linha —
 * `varrerOrfaos` resolve depois. Limite de tamanho (D30) é checado ANTES de
 * qualquer I/O, pra rejeitar rápido sem gravar nada em disco.
 */
export function salvarAnexo(
  db: PsiTrackDatabase,
  anexosDir: string,
  chaveMestra: Buffer,
  bytes: Buffer,
  input: SalvarAnexoInput
): Anexo {
  if (bytes.length > LIMITE_TAMANHO_BYTES) {
    throw new Error(`Arquivo maior que o limite de ${LIMITE_TAMANHO_BYTES / (1024 * 1024)} MB.`)
  }
  const parsed = salvarAnexoInputSchema.parse(input)
  const cifrado = cifrarArquivo(bytes, chaveMestra)

  mkdirSync(anexosDir, { recursive: true })
  const id = uuidv7()
  const tmpPath = join(anexosDir, `${id}.enc.tmp`)
  const finalPath = caminhoBlob(anexosDir, id)
  escreverComFsync(tmpPath, cifrado.blob)
  renameSync(tmpPath, finalPath)

  const now = new Date().toISOString()
  db.insert(anexo)
    .values({
      id,
      pacienteId: parsed.pacienteId,
      evolucaoId: parsed.evolucaoId ?? null,
      classificacao: parsed.classificacao,
      nomeOriginal: parsed.nomeOriginal,
      mime: parsed.mime,
      tamanhoBytes: bytes.length,
      sha256Cifrado: cifrado.sha256Cifrado,
      nonce: cifrado.nonce,
      chaveEnvelopada: cifrado.chaveEnvelopada,
      descricao: parsed.descricao ?? null,
      createdAt: now,
      updatedAt: now
    })
    .run()

  return obterAnexoOuFalhar(db, id)
}

/** Devolve o conteúdo em memória — nunca escreve plaintext em disco (D28, I7). */
export function lerAnexo(db: PsiTrackDatabase, anexosDir: string, chaveMestra: Buffer, anexoId: string): Buffer {
  const row = obterAnexoOuFalhar(db, anexoId)
  const blob = readFileSync(caminhoBlob(anexosDir, row.id))
  return decifrarArquivo(blob, row.nonce, row.chaveEnvelopada, chaveMestra)
}

export interface ResultadoVarredura {
  /** `.tmp` (sempre incompletos) + `.enc` sem linha alguma há mais de 24h. */
  blobsOrfaosRemovidos: string[]
  /** Linha existe, arquivo sumiu — nunca apagada em silêncio, só sinalizada. */
  linhasSemBlob: string[]
}

/**
 * Roda no unlock do cofre. Um `.enc` sem linha (mesmo soft-deletada) só é
 * removido depois de 24h — dá margem pro caso raro de crash bem no meio do
 * insert, sem apagar algo que talvez ainda esteja sendo gravado.
 */
export function varrerOrfaos(db: PsiTrackDatabase, anexosDir: string): ResultadoVarredura {
  const resultado: ResultadoVarredura = { blobsOrfaosRemovidos: [], linhasSemBlob: [] }
  if (!existsSync(anexosDir)) return resultado

  const idsComLinha = new Set(db.select({ id: anexo.id }).from(anexo).all().map((r) => r.id))

  for (const arquivo of readdirSync(anexosDir)) {
    if (arquivo.endsWith('.tmp')) {
      unlinkSync(join(anexosDir, arquivo))
      resultado.blobsOrfaosRemovidos.push(arquivo)
      continue
    }
    if (!arquivo.endsWith('.enc')) continue

    const id = arquivo.slice(0, -'.enc'.length)
    if (idsComLinha.has(id)) continue

    const caminho = join(anexosDir, arquivo)
    const idadeMs = Date.now() - statSync(caminho).mtime.getTime()
    if (idadeMs > ORFAO_IDADE_MINIMA_MS) {
      unlinkSync(caminho)
      resultado.blobsOrfaosRemovidos.push(id)
    }
  }

  for (const id of idsComLinha) {
    if (!existsSync(caminhoBlob(anexosDir, id))) resultado.linhasSemBlob.push(id)
  }

  return resultado
}

/**
 * Purga de verdade (D32) — comando explícito, nunca automático. Remove só o
 * arquivo de anexos com `deletedAt` além do limite; a linha permanece como
 * registro histórico (o prontuário tem guarda legal de até 20 anos —
 * CLAUDE.md).
 */
export function purgarAnexos(db: PsiTrackDatabase, anexosDir: string, dias = 30): string[] {
  const corte = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
  const candidatos = db
    .select()
    .from(anexo)
    .where(and(isNotNull(anexo.deletedAt), lte(anexo.deletedAt, corte)))
    .all()

  const purgados: string[] = []
  for (const row of candidatos) {
    const caminho = caminhoBlob(anexosDir, row.id)
    if (existsSync(caminho)) {
      unlinkSync(caminho)
      purgados.push(row.id)
    }
  }
  return purgados
}
