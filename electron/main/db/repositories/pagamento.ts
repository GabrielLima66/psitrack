import { and, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { cpfSchema } from '../cpf'
import type { PsiTrackDatabase } from '../connection'
import { lancamento, pagamento } from '../schema'
import { uuidv7 } from '../uuidv7'

const MEIO_VALUES = ['pix', 'dinheiro', 'transferencia', 'cartao', 'outro'] as const
const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')

export const registrarPagamentoInputSchema = z.object({
  lancamentoIds: z.array(z.string().min(1)).min(1, 'Selecione ao menos um lançamento.'),
  data: dataSchema,
  meio: z.enum(MEIO_VALUES),
  pagadorNome: z.string().trim().min(1, 'Nome do pagador é obrigatório.'),
  pagadorCpf: cpfSchema.nullish()
})
export type RegistrarPagamentoInput = z.input<typeof registrarPagamentoInputSchema>

export const marcarReciboEmitidoInputSchema = z.object({
  data: dataSchema,
  referencia: z.string().trim().min(1, 'Referência é obrigatória.')
})
export type MarcarReciboEmitidoInput = z.input<typeof marcarReciboEmitidoInputSchema>

export type Pagamento = typeof pagamento.$inferSelect

function obterPagamentoOuFalhar(db: PsiTrackDatabase, id: string): Pagamento {
  const row = db.select().from(pagamento).where(eq(pagamento.id, id)).get()
  if (!row) throw new Error('Pagamento não encontrado.')
  return row
}

export function listarPagamentosPaciente(db: PsiTrackDatabase, pacienteId: string): Pagamento[] {
  return db
    .select()
    .from(pagamento)
    .where(and(eq(pagamento.pacienteId, pacienteId), isNull(pagamento.deletedAt)))
    .orderBy(desc(pagamento.data), desc(pagamento.createdAt))
    .all()
}

/**
 * `valorCentavos` nunca vem do input — é sempre a soma dos lançamentos
 * vinculados, recalculada aqui (critério de aceite da Etapa 13). Pagamento
 * cobre lançamentos inteiros (D23): sem seleção parcial de valor.
 */
export function registrarPagamento(db: PsiTrackDatabase, pacienteId: string, input: RegistrarPagamentoInput): Pagamento {
  const parsed = registrarPagamentoInputSchema.parse(input)

  const executar = db.$client.transaction((): Pagamento => {
    const lancamentos = parsed.lancamentoIds.map((id) => {
      const row = db.select().from(lancamento).where(eq(lancamento.id, id)).get()
      if (!row) throw new Error('Lançamento não encontrado.')
      if (row.pacienteId !== pacienteId) throw new Error('Lançamento não pertence a este paciente.')
      if (row.status === 'pago') throw new Error('Lançamento já pago não pode ser vinculado a um segundo pagamento.')
      if (row.status === 'cancelado') throw new Error('Lançamento cancelado não pode ser pago.')
      return row
    })

    const valorCentavos = lancamentos.reduce((soma, l) => soma + l.valorCentavos, 0)
    const now = new Date().toISOString()
    const id = uuidv7()

    db.insert(pagamento)
      .values({
        id,
        pacienteId,
        valorCentavos,
        data: parsed.data,
        meio: parsed.meio,
        pagadorNome: parsed.pagadorNome,
        pagadorCpf: parsed.pagadorCpf ?? null,
        createdAt: now,
        updatedAt: now
      })
      .run()

    for (const l of lancamentos) {
      db.update(lancamento).set({ status: 'pago', pagamentoId: id, updatedAt: now }).where(eq(lancamento.id, l.id)).run()
    }

    return obterPagamentoOuFalhar(db, id)
  })
  return executar()
}

/** Registro de emissão feita fora do app, não emissão de verdade (D18) — Receita Saúde não tem API de terceiros. */
export function marcarReciboEmitido(db: PsiTrackDatabase, id: string, input: MarcarReciboEmitidoInput): Pagamento {
  obterPagamentoOuFalhar(db, id)
  const parsed = marcarReciboEmitidoInputSchema.parse(input)
  db.update(pagamento)
    .set({ reciboEmitidoEm: parsed.data, reciboReferencia: parsed.referencia, updatedAt: new Date().toISOString() })
    .where(eq(pagamento.id, id))
    .run()
  return obterPagamentoOuFalhar(db, id)
}
