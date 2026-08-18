import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { PsiTrackDatabase } from '../connection'
import { mensagemTemplate } from '../schema'
import { uuidv7 } from '../uuidv7'

export const mensagemTemplateInputSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório.'),
  corpo: z.string().trim().min(1, 'Corpo da mensagem é obrigatório.'),
  padrao: z.boolean().optional()
})
export type MensagemTemplateInput = z.infer<typeof mensagemTemplateInputSchema>

export type MensagemTemplate = typeof mensagemTemplate.$inferSelect

function obterTemplateOuFalhar(db: PsiTrackDatabase, id: string): MensagemTemplate {
  const row = db.select().from(mensagemTemplate).where(eq(mensagemTemplate.id, id)).get()
  if (!row) throw new Error('Modelo de mensagem não encontrado.')
  return row
}

/** `padrao` é global (não por paciente) — no máximo um template ativo marcado por vez. */
function desmarcarPadraoAnterior(db: PsiTrackDatabase, excludingId?: string): void {
  const atuais = db
    .select({ id: mensagemTemplate.id })
    .from(mensagemTemplate)
    .where(and(eq(mensagemTemplate.padrao, true), isNull(mensagemTemplate.deletedAt)))
    .all()

  for (const row of atuais) {
    if (row.id === excludingId) continue
    db.update(mensagemTemplate).set({ padrao: false }).where(eq(mensagemTemplate.id, row.id)).run()
  }
}

export function listarTemplates(db: PsiTrackDatabase): MensagemTemplate[] {
  return db.select().from(mensagemTemplate).where(isNull(mensagemTemplate.deletedAt)).orderBy(mensagemTemplate.nome).all()
}

export function criarTemplate(db: PsiTrackDatabase, input: MensagemTemplateInput): MensagemTemplate {
  const parsed = mensagemTemplateInputSchema.parse(input)
  const now = new Date().toISOString()
  const id = uuidv7()

  if (parsed.padrao) desmarcarPadraoAnterior(db)

  db.insert(mensagemTemplate)
    .values({
      id,
      nome: parsed.nome,
      corpo: parsed.corpo,
      padrao: parsed.padrao ?? false,
      createdAt: now,
      updatedAt: now
    })
    .run()

  return obterTemplateOuFalhar(db, id)
}

export function atualizarTemplate(db: PsiTrackDatabase, id: string, input: MensagemTemplateInput): MensagemTemplate {
  obterTemplateOuFalhar(db, id)
  const parsed = mensagemTemplateInputSchema.parse(input)

  if (parsed.padrao) desmarcarPadraoAnterior(db, id)

  db.update(mensagemTemplate)
    .set({
      nome: parsed.nome,
      corpo: parsed.corpo,
      padrao: parsed.padrao ?? false,
      updatedAt: new Date().toISOString()
    })
    .where(eq(mensagemTemplate.id, id))
    .run()

  return obterTemplateOuFalhar(db, id)
}

/** Soft delete — dado de configuração, não clínico, mesmo padrão do resto do app. */
export function removerTemplate(db: PsiTrackDatabase, id: string): void {
  obterTemplateOuFalhar(db, id)
  db.update(mensagemTemplate)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(mensagemTemplate.id, id))
    .run()
}
