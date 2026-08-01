import { and, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { PsiTrackDatabase } from '../connection'
import { anotacaoPrivada } from '../schema'
import { uuidv7 } from '../uuidv7'

export const anotacaoInputSchema = z.object({
  titulo: z.string().trim().min(1).nullish(),
  conteudo: z.string().trim().min(1, 'O conteúdo não pode ficar vazio.')
})
export type AnotacaoInput = z.infer<typeof anotacaoInputSchema>

export type Anotacao = typeof anotacaoPrivada.$inferSelect

function obterAnotacaoOuFalhar(db: PsiTrackDatabase, id: string): Anotacao {
  const row = db.select().from(anotacaoPrivada).where(eq(anotacaoPrivada.id, id)).get()
  if (!row) throw new Error('Anotação não encontrada.')
  return row
}

export function listarAnotacoes(db: PsiTrackDatabase, pacienteId: string): Anotacao[] {
  return db
    .select()
    .from(anotacaoPrivada)
    .where(and(eq(anotacaoPrivada.pacienteId, pacienteId), isNull(anotacaoPrivada.deletedAt)))
    .orderBy(desc(anotacaoPrivada.updatedAt))
    .all()
}

export function criarAnotacao(db: PsiTrackDatabase, pacienteId: string, input: AnotacaoInput): Anotacao {
  const parsed = anotacaoInputSchema.parse(input)
  const id = uuidv7()
  const now = new Date().toISOString()
  db.insert(anotacaoPrivada)
    .values({ id, pacienteId, titulo: parsed.titulo ?? null, conteudo: parsed.conteudo, createdAt: now, updatedAt: now })
    .run()
  return obterAnotacaoOuFalhar(db, id)
}

/** Ao contrário da evolução: UPDATE de verdade na mesma linha, sem trigger bloqueando (SPEC-fase-1.md, comportamento oposto de propósito). */
export function atualizarAnotacao(db: PsiTrackDatabase, id: string, input: AnotacaoInput): Anotacao {
  obterAnotacaoOuFalhar(db, id)
  const parsed = anotacaoInputSchema.parse(input)
  db.update(anotacaoPrivada)
    .set({ titulo: parsed.titulo ?? null, conteudo: parsed.conteudo, updatedAt: new Date().toISOString() })
    .where(eq(anotacaoPrivada.id, id))
    .run()
  return obterAnotacaoOuFalhar(db, id)
}

/** Soft delete, igual ao resto do app (CLAUDE.md invariante de dado #5) — "excluir" nunca é DELETE físico. */
export function excluirAnotacao(db: PsiTrackDatabase, id: string): void {
  obterAnotacaoOuFalhar(db, id)
  db.update(anotacaoPrivada)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(anotacaoPrivada.id, id))
    .run()
}
