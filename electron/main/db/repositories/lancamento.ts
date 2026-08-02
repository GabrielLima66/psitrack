import { and, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { PsiTrackDatabase } from '../connection'
import { centavosSchema } from '../money'
import { lancamento } from '../schema'
import { uuidv7 } from '../uuidv7'

const TIPO_MANUAL_VALUES = ['ajuste', 'desconto'] as const

export const lancamentoAjusteInputSchema = z.object({
  tipo: z.enum(TIPO_MANUAL_VALUES),
  valorCentavos: centavosSchema.refine((v) => v !== 0, 'Valor não pode ser zero.'),
  descricao: z.string().trim().min(1, 'Descrição é obrigatória.'),
  competencia: z.string().regex(/^\d{4}-\d{2}$/, 'Competência inválida — use AAAA-MM.')
})
export type LancamentoAjusteInput = z.input<typeof lancamentoAjusteInputSchema>

export type Lancamento = typeof lancamento.$inferSelect

function obterLancamentoOuFalhar(db: PsiTrackDatabase, id: string): Lancamento {
  const row = db.select().from(lancamento).where(eq(lancamento.id, id)).get()
  if (!row) throw new Error('Lançamento não encontrado.')
  return row
}

/** Índice único parcial (`idx_lancamento_sessao`) garante isto na base — esta consulta só evita tentar inserir de novo. */
export function obterLancamentoPorSessao(db: PsiTrackDatabase, sessaoId: string): Lancamento | undefined {
  return db
    .select()
    .from(lancamento)
    .where(and(eq(lancamento.sessaoId, sessaoId), isNull(lancamento.deletedAt)))
    .get()
}

export function listarLancamentosPaciente(db: PsiTrackDatabase, pacienteId: string): Lancamento[] {
  return db
    .select()
    .from(lancamento)
    .where(and(eq(lancamento.pacienteId, pacienteId), isNull(lancamento.deletedAt)))
    .orderBy(desc(lancamento.competencia), desc(lancamento.createdAt))
    .all()
}

/** Gerado a partir de uma sessão (`tipo` sessao/falta) — nunca chamado direto de fora, só por `faturamento.ts`. */
export function criarLancamentoDeSessao(
  db: PsiTrackDatabase,
  campos: { pacienteId: string; sessaoId: string; tipo: 'sessao' | 'falta'; valorCentavos: number; competencia: string; descricao: string }
): Lancamento {
  const now = new Date().toISOString()
  const id = uuidv7()
  db.insert(lancamento)
    .values({
      id,
      pacienteId: campos.pacienteId,
      sessaoId: campos.sessaoId,
      tipo: campos.tipo,
      valorCentavos: campos.valorCentavos,
      competencia: campos.competencia,
      descricao: campos.descricao,
      status: 'pendente',
      createdAt: now,
      updatedAt: now
    })
    .run()
  return obterLancamentoOuFalhar(db, id)
}

/** Ajuste/desconto manual — sem `sessaoId` (D23: correção de histórico financeiro é lançamento novo, nunca reescrita). */
export function criarLancamentoAjuste(db: PsiTrackDatabase, pacienteId: string, input: LancamentoAjusteInput): Lancamento {
  const parsed = lancamentoAjusteInputSchema.parse(input)
  const now = new Date().toISOString()
  const id = uuidv7()
  db.insert(lancamento)
    .values({
      id,
      pacienteId,
      sessaoId: null,
      tipo: parsed.tipo,
      valorCentavos: parsed.valorCentavos,
      competencia: parsed.competencia,
      descricao: parsed.descricao,
      status: 'pendente',
      createdAt: now,
      updatedAt: now
    })
    .run()
  return obterLancamentoOuFalhar(db, id)
}

/** Só cancela pendente — pago é bloqueado por quem chama (faturamento.ts), nunca aqui (esta função não sabe o motivo). */
export function cancelarLancamento(db: PsiTrackDatabase, id: string): Lancamento {
  const atual = obterLancamentoOuFalhar(db, id)
  if (atual.status === 'pago') {
    throw new Error('Lançamento já pago não pode ser cancelado — registre um lançamento de ajuste.')
  }
  db.update(lancamento)
    .set({ status: 'cancelado', updatedAt: new Date().toISOString() })
    .where(eq(lancamento.id, id))
    .run()
  return obterLancamentoOuFalhar(db, id)
}
