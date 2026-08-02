import { and, desc, eq, isNull, lte } from 'drizzle-orm'
import type { PsiTrackDatabase } from '../connection'
import { contratoPreco } from '../schema'

export type ContratoPreco = typeof contratoPreco.$inferSelect

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
