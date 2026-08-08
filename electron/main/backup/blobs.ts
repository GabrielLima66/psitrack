import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { PsiTrackDatabase } from '../db/connection'
import { anexo } from '../db/schema'

export interface BlobManifestEntry {
  id: string
  sha256Cifrado: string
  tamanhoBytes: number
}

// GCM: ciphertext tem o mesmo tamanho do plaintext, mais o authTag de 16
// bytes concatenado (anexoCripto.ts: `blob = ciphertext + authTag`).
// `anexo.tamanhoBytes` guarda o tamanho do PLAINTEXT (útil pra UI mostrar o
// tamanho real do arquivo original) — o `.enc` em disco é sempre 16 bytes
// maior que isso.
export const AUTH_TAG_LENGTH_BYTES = 16

function caminhoBlob(dir: string, id: string): string {
  return join(dir, `${id}.enc`)
}

function tabelaAnexoExiste(db: PsiTrackDatabase): boolean {
  return db.$client.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'anexo'`).get() !== undefined
}

/**
 * TODAS as linhas, inclusive soft-deletadas — o blob físico só some de
 * verdade na purga (Etapa 14/D32). Backup espelha o que existe em disco
 * agora, não o que "deveria" existir segundo o estado lógico do prontuário.
 *
 * Chamada também pelo snapshot pré-migração (Etapa 9/15), que roda ANTES da
 * migration ser aplicada — pra um banco que ainda está numa versão anterior
 * à 0004 (Etapa 14), a tabela `anexo` simplesmente ainda não existe. Sem essa
 * checagem, `db.select().from(anexo)` explode com "no such table: anexo" e
 * a migração nunca chega a rodar, travando o desbloqueio pra sempre.
 */
export function listarBlobsParaManifesto(db: PsiTrackDatabase): BlobManifestEntry[] {
  if (!tabelaAnexoExiste(db)) return []
  return db
    .select({ id: anexo.id, sha256Cifrado: anexo.sha256Cifrado, tamanhoBytes: anexo.tamanhoBytes })
    .from(anexo)
    .all()
}

/**
 * Copia cada blob referenciado por uma linha da origem pro destino. Lança se
 * um blob esperado estiver faltando na origem — um backup não pode
 * silenciosamente pular um anexo que devia existir (SPEC-fase-3.md §1).
 */
export function copiarBlobs(anexosDir: string, destDir: string, entries: BlobManifestEntry[]): void {
  mkdirSync(destDir, { recursive: true })
  for (const entrada of entries) {
    const origem = caminhoBlob(anexosDir, entrada.id)
    if (!existsSync(origem)) {
      throw new Error(`Blob ${entrada.id} referenciado no banco, mas ausente em ${anexosDir}.`)
    }
    copyFileSync(origem, caminhoBlob(destDir, entrada.id))
  }
}

/**
 * Presença + tamanho + hash de um conjunto de blobs, contra qualquer esquema
 * de endereçamento em disco — local usa `{dir}/{id}.enc`, o pool do destino
 * externo usa `{pool}/{sha256}.enc` (destinos.ts). O que muda entre os dois é
 * só como resolver o caminho e como identificar a entrada nas mensagens de
 * erro; a checagem em si (presença, tamanho com o authTag do GCM, hash) é a
 * mesma, então vive uma vez só aqui.
 */
export function verificarPresencaTamanhoHash(
  entries: BlobManifestEntry[],
  caminhoDoBlob: (entrada: BlobManifestEntry) => string,
  identificador: (entrada: BlobManifestEntry) => string,
  descricaoAusente: string
): { ok: boolean; problemas: string[] } {
  const problemas: string[] = []

  for (const entrada of entries) {
    const caminho = caminhoDoBlob(entrada)
    const id = identificador(entrada)
    if (!existsSync(caminho)) {
      problemas.push(`${id}: ${descricaoAusente}`)
      continue
    }
    const tamanhoEsperadoNoDisco = entrada.tamanhoBytes + AUTH_TAG_LENGTH_BYTES
    const tamanhoReal = statSync(caminho).size
    if (tamanhoReal !== tamanhoEsperadoNoDisco) {
      problemas.push(`${id}: tamanho esperado ${tamanhoEsperadoNoDisco}, encontrado ${tamanhoReal}`)
      continue
    }
    const hashReal = createHash('sha256').update(readFileSync(caminho)).digest('hex')
    if (hashReal !== entrada.sha256Cifrado) {
      problemas.push(`${id}: hash divergente`)
    }
  }

  return { ok: problemas.length === 0, problemas }
}

/** Confere cada entry do manifesto contra o que está de fato em `blobsDir`: presença, tamanho e hash — sem decifrar nada (D26). */
export function verificarBlobs(entries: BlobManifestEntry[], blobsDir: string): { ok: boolean; problemas: string[] } {
  return verificarPresencaTamanhoHash(
    entries,
    (entrada) => caminhoBlob(blobsDir, entrada.id),
    (entrada) => entrada.id,
    'arquivo ausente'
  )
}
