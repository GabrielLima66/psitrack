import { and, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { PsiTrackDatabase } from '../connection'
import { pacienteEncaminhamento } from '../schema'
import { uuidv7 } from '../uuidv7'

const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')

/** Encaminhamento de SAÍDA (D47) — a entrada continua sendo o campo `origem` de `pacientes`. */
export const encaminhamentoInputSchema = z.object({
  paraQuem: z.string().trim().min(1, 'Para quem o encaminhamento foi feito é obrigatório.'),
  especialidade: z.string().trim().min(1).nullish(),
  data: dataSchema,
  motivo: z.string().trim().min(1).nullish(),
  observacao: z.string().trim().min(1).nullish()
})
export type EncaminhamentoInput = z.infer<typeof encaminhamentoInputSchema>

export type Encaminhamento = typeof pacienteEncaminhamento.$inferSelect

function obterEncaminhamentoOuFalhar(db: PsiTrackDatabase, id: string): Encaminhamento {
  const row = db.select().from(pacienteEncaminhamento).where(eq(pacienteEncaminhamento.id, id)).get()
  if (!row) throw new Error('Encaminhamento não encontrado.')
  return row
}

/** Mais recente primeiro. */
export function listarEncaminhamentos(db: PsiTrackDatabase, pacienteId: string): Encaminhamento[] {
  return db
    .select()
    .from(pacienteEncaminhamento)
    .where(and(eq(pacienteEncaminhamento.pacienteId, pacienteId), isNull(pacienteEncaminhamento.deletedAt)))
    .orderBy(desc(pacienteEncaminhamento.data), desc(pacienteEncaminhamento.createdAt))
    .all()
}

export function criarEncaminhamento(db: PsiTrackDatabase, pacienteId: string, input: EncaminhamentoInput): Encaminhamento {
  const parsed = encaminhamentoInputSchema.parse(input)
  const now = new Date().toISOString()
  const id = uuidv7()

  db.insert(pacienteEncaminhamento)
    .values({
      id,
      pacienteId,
      paraQuem: parsed.paraQuem,
      especialidade: parsed.especialidade ?? null,
      data: parsed.data,
      motivo: parsed.motivo ?? null,
      observacao: parsed.observacao ?? null,
      createdAt: now,
      updatedAt: now
    })
    .run()

  return obterEncaminhamentoOuFalhar(db, id)
}

export function atualizarEncaminhamento(db: PsiTrackDatabase, id: string, input: EncaminhamentoInput): Encaminhamento {
  obterEncaminhamentoOuFalhar(db, id)
  const parsed = encaminhamentoInputSchema.parse(input)

  db.update(pacienteEncaminhamento)
    .set({
      paraQuem: parsed.paraQuem,
      especialidade: parsed.especialidade ?? null,
      data: parsed.data,
      motivo: parsed.motivo ?? null,
      observacao: parsed.observacao ?? null,
      updatedAt: new Date().toISOString()
    })
    .where(eq(pacienteEncaminhamento.id, id))
    .run()

  return obterEncaminhamentoOuFalhar(db, id)
}

/** Soft delete — dado clínico, some da listagem mas nunca do banco (invariante de dado #5). */
export function removerEncaminhamento(db: PsiTrackDatabase, id: string): void {
  obterEncaminhamentoOuFalhar(db, id)
  const now = new Date().toISOString()
  db.update(pacienteEncaminhamento).set({ deletedAt: now, updatedAt: now }).where(eq(pacienteEncaminhamento.id, id)).run()
}
