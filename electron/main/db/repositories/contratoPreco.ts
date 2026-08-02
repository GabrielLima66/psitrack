import { and, desc, eq, isNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import type { PsiTrackDatabase } from '../connection'
import { centavosSchema } from '../money'
import { contratoPreco } from '../schema'
import { uuidv7 } from '../uuidv7'

const MODALIDADE_VALUES = ['avulso', 'mensal'] as const // 'encerrado' é escrito só por uma futura função de encerramento (Etapa 12)
const POLITICA_FALTA_VALUES = ['cobra_sempre', 'cobra_sem_aviso', 'nunca_cobra'] as const

export const contratoPrecoInputSchema = z.object({
  modalidade: z.enum(MODALIDADE_VALUES),
  valorCentavos: centavosSchema.refine((v) => v > 0, 'Valor deve ser maior que zero.'),
  politicaFalta: z.enum(POLITICA_FALTA_VALUES).default('cobra_sem_aviso'),
  avisoMinimoHoras: z.number().int().nonnegative().default(24),
  vigenciaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.'),
  observacao: z.string().trim().min(1).nullish()
})
export type ContratoPrecoInput = z.input<typeof contratoPrecoInputSchema>

export type ContratoPreco = typeof contratoPreco.$inferSelect

function obterContratoOuFalhar(db: PsiTrackDatabase, id: string): ContratoPreco {
  const row = db.select().from(contratoPreco).where(eq(contratoPreco.id, id)).get()
  if (!row) throw new Error('Contrato de preço não encontrado.')
  return row
}

/** Reajuste (I3) é só mais uma chamada desta função com `vigenciaInicio` mais recente — nunca UPDATE em linha existente (D11). */
export function criarContratoPreco(db: PsiTrackDatabase, pacienteId: string, input: ContratoPrecoInput): ContratoPreco {
  const parsed = contratoPrecoInputSchema.parse(input)
  const now = new Date().toISOString()
  const id = uuidv7()

  db.insert(contratoPreco)
    .values({
      id,
      pacienteId,
      modalidade: parsed.modalidade,
      valorCentavos: parsed.valorCentavos,
      politicaFalta: parsed.politicaFalta,
      avisoMinimoHoras: parsed.avisoMinimoHoras,
      vigenciaInicio: parsed.vigenciaInicio,
      observacao: parsed.observacao ?? null,
      createdAt: now,
      updatedAt: now
    })
    .run()

  return obterContratoOuFalhar(db, id)
}

/**
 * Preço vigente numa data — consulta única, sem sobreposição possível
 * (SPEC-fase-2.md §4.3, D11): a tabela só grava `vigenciaInicio`, o fim de
 * cada vigência é implícito pelo início da linha seguinte. Encerrar
 * contrato (D12) é só mais uma linha, `modalidade = 'encerrado'` — esta
 * função devolve ela normalmente, quem chama decide o que fazer com
 * `valorCentavos` null.
 */
export function precoVigenteEm(db: PsiTrackDatabase, pacienteId: string, data: string): ContratoPreco | undefined {
  return db
    .select()
    .from(contratoPreco)
    .where(
      and(eq(contratoPreco.pacienteId, pacienteId), isNull(contratoPreco.deletedAt), lte(contratoPreco.vigenciaInicio, data))
    )
    .orderBy(desc(contratoPreco.vigenciaInicio))
    .limit(1)
    .get()
}
