import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { PsiTrackDatabase } from '../connection'
import { recorrencia } from '../schema'
import { uuidv7 } from '../uuidv7'

const MODALIDADE_VALUES = ['presencial', 'online'] as const

export const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')
const horaLocalSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida — use HH:MM.')

export const recorrenciaInputSchema = z.object({
  diaSemana: z.number().int().min(0).max(6),
  horaLocal: horaLocalSchema,
  duracaoMin: z.number().int().positive().default(50),
  modalidade: z.enum(MODALIDADE_VALUES),
  vigenciaInicio: dataSchema
})
// `z.input`, não `z.infer`/`z.output`: `duracaoMin` tem `.default(50)`, e o
// tipo exportado precisa refletir que quem chama PODE omitir esse campo —
// `z.infer` (= `z.output`) exigiria ele preenchido, escondendo o default.
export type RecorrenciaInput = z.input<typeof recorrenciaInputSchema>

export type Recorrencia = typeof recorrencia.$inferSelect

function obterRecorrenciaOuFalhar(db: PsiTrackDatabase, id: string): Recorrencia {
  const row = db.select().from(recorrencia).where(eq(recorrencia.id, id)).get()
  if (!row) throw new Error('Horário fixo não encontrado.')
  return row
}

/** Só as ativas (sem `vigenciaFim`, ou com fim ainda no futuro) importam pra materialização — mas a lista mostra tudo, inclusive encerradas, pro histórico do cadastro. */
export function listarRecorrencias(db: PsiTrackDatabase, pacienteId: string): Recorrencia[] {
  return db
    .select()
    .from(recorrencia)
    .where(and(eq(recorrencia.pacienteId, pacienteId), isNull(recorrencia.deletedAt)))
    .all()
}

export function listarRecorrenciasAtivas(db: PsiTrackDatabase): Recorrencia[] {
  return db.select().from(recorrencia).where(isNull(recorrencia.deletedAt)).all()
}

export function criarRecorrencia(db: PsiTrackDatabase, pacienteId: string, input: RecorrenciaInput): Recorrencia {
  const parsed = recorrenciaInputSchema.parse(input)
  const now = new Date().toISOString()
  const id = uuidv7()

  db.insert(recorrencia)
    .values({
      id,
      pacienteId,
      diaSemana: parsed.diaSemana,
      horaLocal: parsed.horaLocal,
      duracaoMin: parsed.duracaoMin,
      modalidade: parsed.modalidade,
      vigenciaInicio: parsed.vigenciaInicio,
      createdAt: now,
      updatedAt: now
    })
    .run()

  return obterRecorrenciaOuFalhar(db, id)
}

/**
 * `vigenciaFim` é o fim da série — nunca UPDATE de histórico, só grava a
 * data de corte (mesmo raciocínio de D11 pro contrato). Quem cuida de
 * cancelar as ocorrências futuras já materializadas é `sessao.ts` — esta
 * função só mexe na tabela `recorrencia`.
 */
export function encerrarRecorrencia(db: PsiTrackDatabase, id: string, vigenciaFim: string): Recorrencia {
  obterRecorrenciaOuFalhar(db, id)
  const dataFim = dataSchema.parse(vigenciaFim)
  db.update(recorrencia)
    .set({ vigenciaFim: dataFim, updatedAt: new Date().toISOString() })
    .where(eq(recorrencia.id, id))
    .run()
  return obterRecorrenciaOuFalhar(db, id)
}
