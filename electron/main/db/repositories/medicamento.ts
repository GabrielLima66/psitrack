import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { PsiTrackDatabase } from '../connection'
import { pacienteMedicamento } from '../schema'
import { uuidv7 } from '../uuidv7'

const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')

export const medicamentoInputSchema = z.object({
  nome: z.string().trim().min(1, 'Nome do medicamento é obrigatório.'),
  dose: z.string().trim().min(1).nullish(),
  prescritor: z.string().trim().min(1).nullish(),
  inicio: dataSchema.nullish(),
  fim: dataSchema.nullish(),
  observacao: z.string().trim().min(1).nullish()
})
export type MedicamentoInput = z.infer<typeof medicamentoInputSchema>

export type Medicamento = typeof pacienteMedicamento.$inferSelect

function obterMedicamentoOuFalhar(db: PsiTrackDatabase, id: string): Medicamento {
  const row = db.select().from(pacienteMedicamento).where(eq(pacienteMedicamento.id, id)).get()
  if (!row) throw new Error('Medicamento não encontrado.')
  return row
}

/**
 * Em uso primeiro (`fim = null`, D44), depois os encerrados do mais recente
 * pro mais antigo. A ordenação é feita em JS e não em SQL porque `fim` nulo
 * ordena de forma diferente entre dialetos e a lista aqui é curta por
 * natureza — clareza vale mais que um ORDER BY com NULLS FIRST.
 */
export function listarMedicamentos(db: PsiTrackDatabase, pacienteId: string): Medicamento[] {
  const linhas = db
    .select()
    .from(pacienteMedicamento)
    .where(and(eq(pacienteMedicamento.pacienteId, pacienteId), isNull(pacienteMedicamento.deletedAt)))
    .all()

  return linhas.sort((a, b) => {
    if (!a.fim && b.fim) return -1
    if (a.fim && !b.fim) return 1
    if (!a.fim && !b.fim) return a.nome.localeCompare(b.nome, 'pt-BR')
    return (b.fim ?? '').localeCompare(a.fim ?? '')
  })
}

export function criarMedicamento(db: PsiTrackDatabase, pacienteId: string, input: MedicamentoInput): Medicamento {
  const parsed = medicamentoInputSchema.parse(input)
  const now = new Date().toISOString()
  const id = uuidv7()

  db.insert(pacienteMedicamento)
    .values({
      id,
      pacienteId,
      nome: parsed.nome,
      dose: parsed.dose ?? null,
      prescritor: parsed.prescritor ?? null,
      inicio: parsed.inicio ?? null,
      fim: parsed.fim ?? null,
      observacao: parsed.observacao ?? null,
      createdAt: now,
      updatedAt: now
    })
    .run()

  return obterMedicamentoOuFalhar(db, id)
}

export function atualizarMedicamento(db: PsiTrackDatabase, id: string, input: MedicamentoInput): Medicamento {
  obterMedicamentoOuFalhar(db, id)
  const parsed = medicamentoInputSchema.parse(input)

  db.update(pacienteMedicamento)
    .set({
      nome: parsed.nome,
      dose: parsed.dose ?? null,
      prescritor: parsed.prescritor ?? null,
      inicio: parsed.inicio ?? null,
      fim: parsed.fim ?? null,
      observacao: parsed.observacao ?? null,
      updatedAt: new Date().toISOString()
    })
    .where(eq(pacienteMedicamento.id, id))
    .run()

  return obterMedicamentoOuFalhar(db, id)
}

/** Soft delete — dado clínico, some da listagem mas nunca do banco (invariante de dado #5). */
export function removerMedicamento(db: PsiTrackDatabase, id: string): void {
  obterMedicamentoOuFalhar(db, id)
  const now = new Date().toISOString()
  db.update(pacienteMedicamento).set({ deletedAt: now, updatedAt: now }).where(eq(pacienteMedicamento.id, id)).run()
}
