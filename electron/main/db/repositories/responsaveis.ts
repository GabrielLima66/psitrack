import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { cpfSchema } from '../cpf'
import type { PsiTrackDatabase } from '../connection'
import { pacienteResponsavel } from '../schema'
import { uuidv7 } from '../uuidv7'

const PARENTESCO_VALUES = ['mae', 'pai', 'avo', 'tutor', 'outro'] as const

export const responsavelInputSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório.'),
  cpf: cpfSchema.nullish(),
  parentesco: z.enum(PARENTESCO_VALUES),
  telefone: z.string().trim().min(1).nullish(),
  email: z.email('E-mail inválido.').nullish(),
  principal: z.boolean().optional(),
  pagador: z.boolean().optional()
})
export type ResponsavelInput = z.infer<typeof responsavelInputSchema>

export type Responsavel = typeof pacienteResponsavel.$inferSelect

function obterResponsavelOuFalhar(db: PsiTrackDatabase, id: string): Responsavel {
  const row = db.select().from(pacienteResponsavel).where(eq(pacienteResponsavel.id, id)).get()
  if (!row) throw new Error('Responsável não encontrado.')
  return row
}

/** `principal` é o contato preferencial — no máximo um ativo por paciente (regra de aplicação, SPEC-fase-1.md D4). */
function desmarcarPrincipalAnterior(db: PsiTrackDatabase, pacienteId: string, excludingId?: string): void {
  const atuais = db
    .select({ id: pacienteResponsavel.id })
    .from(pacienteResponsavel)
    .where(
      and(eq(pacienteResponsavel.pacienteId, pacienteId), eq(pacienteResponsavel.principal, true), isNull(pacienteResponsavel.deletedAt))
    )
    .all()

  for (const row of atuais) {
    if (row.id === excludingId) continue
    db.update(pacienteResponsavel).set({ principal: false }).where(eq(pacienteResponsavel.id, row.id)).run()
  }
}

export function listarResponsaveis(db: PsiTrackDatabase, pacienteId: string): Responsavel[] {
  return db
    .select()
    .from(pacienteResponsavel)
    .where(and(eq(pacienteResponsavel.pacienteId, pacienteId), isNull(pacienteResponsavel.deletedAt)))
    .all()
}

export function criarResponsavel(db: PsiTrackDatabase, pacienteId: string, input: ResponsavelInput): Responsavel {
  const parsed = responsavelInputSchema.parse(input)
  const now = new Date().toISOString()
  const id = uuidv7()

  if (parsed.principal) desmarcarPrincipalAnterior(db, pacienteId)

  db.insert(pacienteResponsavel)
    .values({
      id,
      pacienteId,
      nome: parsed.nome,
      cpf: parsed.cpf ?? null,
      parentesco: parsed.parentesco,
      telefone: parsed.telefone ?? null,
      email: parsed.email ?? null,
      principal: parsed.principal ?? false,
      pagador: parsed.pagador ?? false,
      createdAt: now,
      updatedAt: now
    })
    .run()

  return obterResponsavelOuFalhar(db, id)
}

export function atualizarResponsavel(db: PsiTrackDatabase, id: string, input: ResponsavelInput): Responsavel {
  const existing = obterResponsavelOuFalhar(db, id)
  const parsed = responsavelInputSchema.parse(input)

  if (parsed.principal) desmarcarPrincipalAnterior(db, existing.pacienteId, id)

  db.update(pacienteResponsavel)
    .set({
      nome: parsed.nome,
      cpf: parsed.cpf ?? null,
      parentesco: parsed.parentesco,
      telefone: parsed.telefone ?? null,
      email: parsed.email ?? null,
      principal: parsed.principal ?? false,
      pagador: parsed.pagador ?? false,
      updatedAt: new Date().toISOString()
    })
    .where(eq(pacienteResponsavel.id, id))
    .run()

  return obterResponsavelOuFalhar(db, id)
}

/** Soft delete — dado cadastral, não clínico, mas mantém o mesmo padrão de exclusão do resto do app. */
export function removerResponsavel(db: PsiTrackDatabase, id: string): void {
  obterResponsavelOuFalhar(db, id)
  db.update(pacienteResponsavel)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(pacienteResponsavel.id, id))
    .run()
}
