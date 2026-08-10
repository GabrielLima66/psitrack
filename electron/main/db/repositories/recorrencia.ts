import { and, eq, getTableColumns, isNull, ne } from 'drizzle-orm'
import { z } from 'zod'
import type { PsiTrackDatabase } from '../connection'
import { pacientes, recorrencia } from '../schema'
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

export interface ConflitoRecorrencia {
  recorrenciaId: string
  pacienteId: string
  pacienteNome: string
  diaSemana: number
  horaLocal: string
  duracaoMin: number
}

function horaParaMinutos(horaLocal: string): number {
  const [hora, minuto] = horaLocal.split(':').map(Number)
  return hora! * 60 + minuto!
}

/**
 * Aviso, não bloqueio (mesmo critério de `sobreposicaoHorario` em sessao.ts):
 * outra recorrência ativa, de OUTRO paciente, no mesmo dia da semana, com
 * horário que se sobrepõe. Quem chama decide se avisa e deixa a usuária
 * seguir mesmo assim. `excludingRecorrenciaId` é pra quando a checagem é de
 * uma recorrência que já existe (não faz sentido conflitar com ela mesma).
 * `pacienteId` é `null` durante o cadastro combinado (Etapa 11/D24): o
 * paciente ainda não tem id, então não há recorrência própria pra excluir.
 */
export function conflitosRecorrencia(
  db: PsiTrackDatabase,
  pacienteId: string | null,
  input: { diaSemana: number; horaLocal: string; duracaoMin: number; vigenciaInicio: string },
  excludingRecorrenciaId?: string
): ConflitoRecorrencia[] {
  const condicoes = [eq(recorrencia.diaSemana, input.diaSemana), isNull(recorrencia.deletedAt)]
  if (pacienteId) condicoes.push(ne(recorrencia.pacienteId, pacienteId))

  const candidatas = db
    .select({ ...getTableColumns(recorrencia), pacienteNome: pacientes.nome })
    .from(recorrencia)
    .innerJoin(pacientes, eq(recorrencia.pacienteId, pacientes.id))
    .where(and(...condicoes))
    .all()

  const inicioMin = horaParaMinutos(input.horaLocal)
  const fimMin = inicioMin + input.duracaoMin

  return candidatas
    .filter((r) => r.id !== excludingRecorrenciaId)
    .filter((r) => !r.vigenciaFim || r.vigenciaFim > input.vigenciaInicio) // ainda ativa quando a nova começar
    .filter((r) => {
      const outroInicioMin = horaParaMinutos(r.horaLocal)
      const outroFimMin = outroInicioMin + r.duracaoMin
      return inicioMin < outroFimMin && outroInicioMin < fimMin
    })
    .map((r) => ({
      recorrenciaId: r.id,
      pacienteId: r.pacienteId,
      pacienteNome: r.pacienteNome,
      diaSemana: r.diaSemana,
      horaLocal: r.horaLocal,
      duracaoMin: r.duracaoMin
    }))
}
