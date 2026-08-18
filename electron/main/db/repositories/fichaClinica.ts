import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { PsiTrackDatabase } from '../connection'
import { pacienteFichaClinica } from '../schema'
import { uuidv7 } from '../uuidv7'

export const fichaClinicaInputSchema = z.object({
  demandaInicial: z.string().trim().min(1).nullish(),
  abordagem: z.string().trim().min(1).nullish()
})
export type FichaClinicaInput = z.infer<typeof fichaClinicaInputSchema>

/**
 * No cadastro de paciente novo os dois são OBRIGATÓRIOS: demanda inicial e
 * abordagem são o ponto de partida do prontuário, e cadastrar sem elas cria
 * uma ficha que ninguém volta pra completar. Ao editar depois, o schema
 * leniente acima é que vale — um paciente antigo pode ter os campos vazios,
 * e limpar um campo não pode ficar impossível.
 */
export const fichaClinicaObrigatoriaSchema = z.object({
  demandaInicial: z.string().trim().min(1, 'Demanda inicial é obrigatória.'),
  abordagem: z.string().trim().min(1, 'Abordagem é obrigatória.')
})
export type FichaClinicaObrigatoria = z.infer<typeof fichaClinicaObrigatoriaSchema>

export type FichaClinica = typeof pacienteFichaClinica.$inferSelect

/** `null` até a primeira gravação — paciente sem ficha clínica é o estado normal, não erro. */
export function obterFichaClinica(db: PsiTrackDatabase, pacienteId: string): FichaClinica | null {
  return (
    db
      .select()
      .from(pacienteFichaClinica)
      .where(and(eq(pacienteFichaClinica.pacienteId, pacienteId), isNull(pacienteFichaClinica.deletedAt)))
      .get() ?? null
  )
}

/**
 * Upsert: cria na primeira gravação, atualiza da segunda em diante. É 1:1 com
 * paciente (índice único parcial no schema), então nunca existe "qual das
 * fichas" — quem chama não precisa saber se já existe.
 */
export function salvarFichaClinica(db: PsiTrackDatabase, pacienteId: string, input: FichaClinicaInput): FichaClinica {
  const parsed = fichaClinicaInputSchema.parse(input)
  const now = new Date().toISOString()
  const existente = obterFichaClinica(db, pacienteId)

  if (existente) {
    db.update(pacienteFichaClinica)
      .set({
        demandaInicial: parsed.demandaInicial ?? null,
        abordagem: parsed.abordagem ?? null,
        updatedAt: now
      })
      .where(eq(pacienteFichaClinica.id, existente.id))
      .run()
    return obterFichaClinica(db, pacienteId)!
  }

  db.insert(pacienteFichaClinica)
    .values({
      id: uuidv7(),
      pacienteId,
      demandaInicial: parsed.demandaInicial ?? null,
      abordagem: parsed.abordagem ?? null,
      createdAt: now,
      updatedAt: now
    })
    .run()

  return obterFichaClinica(db, pacienteId)!
}
