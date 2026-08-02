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
const AUTH_TAG_LENGTH_BYTES = 16

function caminhoBlob(dir: string, id: string): string {
  return join(dir, `${id}.enc`)
}

/**
 * TODAS as linhas, inclusive soft-deletadas — o blob físico só some de
 * verdade na purga (Etapa 14/D32). Backup espelha o que existe em disco
 * agora, não o que "deveria" existir segundo o estado lógico do prontuário.
 */
export function listarBlobsParaManifesto(db: PsiTrackDatabase): BlobManifestEntry[] {
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

/** Confere cada entry do manifesto contra o que está de fato em `blobsDir`: presença, tamanho e hash — sem decifrar nada (D26). */
export function verificarBlobs(entries: BlobManifestEntry[], blobsDir: string): { ok: boolean; problemas: string[] } {
  const problemas: string[] = []

  for (const entrada of entries) {
    const caminho = caminhoBlob(blobsDir, entrada.id)
    if (!existsSync(caminho)) {
      problemas.push(`${entrada.id}: arquivo ausente`)
      continue
    }
    const tamanhoEsperadoNoDisco = entrada.tamanhoBytes + AUTH_TAG_LENGTH_BYTES
    const tamanhoReal = statSync(caminho).size
    if (tamanhoReal !== tamanhoEsperadoNoDisco) {
      problemas.push(`${entrada.id}: tamanho esperado ${tamanhoEsperadoNoDisco}, encontrado ${tamanhoReal}`)
      continue
    }
    const hashReal = createHash('sha256').update(readFileSync(caminho)).digest('hex')
    if (hashReal !== entrada.sha256Cifrado) {
      problemas.push(`${entrada.id}: hash divergente`)
    }
  }

  return { ok: problemas.length === 0, problemas }
}
