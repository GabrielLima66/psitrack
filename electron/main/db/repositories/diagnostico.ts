import { and, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { PsiTrackDatabase } from '../connection'
import { pacienteDiagnostico } from '../schema'
import { uuidv7 } from '../uuidv7'

const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.')

export const diagnosticoInputSchema = z.object({
  descricao: z.string().trim().min(1, 'Descrição do diagnóstico é obrigatória.'),
  cid: z.string().trim().min(1).nullish(), // texto livre — o app nunca valida código
  data: dataSchema.nullish(),
  profissional: z.string().trim().min(1).nullish(),
  observacao: z.string().trim().min(1).nullish()
})
export type DiagnosticoInput = z.infer<typeof diagnosticoInputSchema>

export type Diagnostico = typeof pacienteDiagnostico.$inferSelect

function obterDiagnosticoOuFalhar(db: PsiTrackDatabase, id: string): Diagnostico {
  const row = db.select().from(pacienteDiagnostico).where(eq(pacienteDiagnostico.id, id)).get()
  if (!row) throw new Error('Diagnóstico não encontrado.')
  return row
}

/** Mais recente primeiro; sem data cai pro fim da lista (ordena por `createdAt` como desempate). */
export function listarDiagnosticos(db: PsiTrackDatabase, pacienteId: string): Diagnostico[] {
  return db
    .select()
    .from(pacienteDiagnostico)
    .where(and(eq(pacienteDiagnostico.pacienteId, pacienteId), isNull(pacienteDiagnostico.deletedAt)))
    .orderBy(desc(pacienteDiagnostico.data), desc(pacienteDiagnostico.createdAt))
    .all()
}

export function criarDiagnostico(db: PsiTrackDatabase, pacienteId: string, input: DiagnosticoInput): Diagnostico {
  const parsed = diagnosticoInputSchema.parse(input)
  const now = new Date().toISOString()
  const id = uuidv7()

  db.insert(pacienteDiagnostico)
    .values({
      id,
      pacienteId,
      descricao: parsed.descricao,
      cid: parsed.cid ?? null,
      data: parsed.data ?? null,
      profissional: parsed.profissional ?? null,
      observacao: parsed.observacao ?? null,
      createdAt: now,
      updatedAt: now
    })
    .run()

  return obterDiagnosticoOuFalhar(db, id)
}

export function atualizarDiagnostico(db: PsiTrackDatabase, id: string, input: DiagnosticoInput): Diagnostico {
  obterDiagnosticoOuFalhar(db, id)
  const parsed = diagnosticoInputSchema.parse(input)

  db.update(pacienteDiagnostico)
    .set({
      descricao: parsed.descricao,
      cid: parsed.cid ?? null,
      data: parsed.data ?? null,
      profissional: parsed.profissional ?? null,
      observacao: parsed.observacao ?? null,
      updatedAt: new Date().toISOString()
    })
    .where(eq(pacienteDiagnostico.id, id))
    .run()

  return obterDiagnosticoOuFalhar(db, id)
}

/** Soft delete — dado clínico, some da listagem mas nunca do banco (invariante de dado #5). */
export function removerDiagnostico(db: PsiTrackDatabase, id: string): void {
  obterDiagnosticoOuFalhar(db, id)
  const now = new Date().toISOString()
  db.update(pacienteDiagnostico).set({ deletedAt: now, updatedAt: now }).where(eq(pacienteDiagnostico.id, id)).run()
}
