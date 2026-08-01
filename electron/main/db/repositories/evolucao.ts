import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { PsiTrackDatabase } from '../connection'
import { prontuarioEvolucao } from '../schema'
import { uuidv7 } from '../uuidv7'

const TIPO_VALUES = ['sessao', 'contato', 'administrativo'] as const

const dataSessaoSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data da sessão inválida.')

export const criarEvolucaoSchema = z.object({
  pacienteId: z.string().min(1),
  conteudo: z.string().trim().min(1, 'O conteúdo não pode ficar vazio.'),
  dataSessao: dataSessaoSchema,
  tipo: z.enum(TIPO_VALUES).default('sessao')
})
export type CriarEvolucaoInput = z.infer<typeof criarEvolucaoSchema>

export const retificarEvolucaoSchema = z.object({
  retificaId: z.string().min(1),
  conteudo: z.string().trim().min(1, 'O conteúdo não pode ficar vazio.'),
  dataSessao: dataSessaoSchema,
  tipo: z.enum(TIPO_VALUES).default('sessao'),
  motivoRetificacao: z.string().trim().min(1, 'Motivo da retificação é obrigatório.')
})
export type RetificarEvolucaoInput = z.infer<typeof retificarEvolucaoSchema>

export type Evolucao = typeof prontuarioEvolucao.$inferSelect

function obterEvolucaoOuFalhar(db: PsiTrackDatabase, id: string): Evolucao {
  const row = db.select().from(prontuarioEvolucao).where(eq(prontuarioEvolucao.id, id)).get()
  if (!row) throw new Error('Entrada de evolução não encontrada.')
  return row
}

/** Ordenada por data da sessão, não por quando foi digitada (CLAUDE.md/SPEC-fase-1.md: podem divergir). */
export function listarEvolucoes(db: PsiTrackDatabase, pacienteId: string): Evolucao[] {
  return db
    .select()
    .from(prontuarioEvolucao)
    .where(eq(prontuarioEvolucao.pacienteId, pacienteId))
    .orderBy(desc(prontuarioEvolucao.dataSessao), desc(prontuarioEvolucao.createdAt))
    .all()
}

export function criarEvolucao(db: PsiTrackDatabase, input: CriarEvolucaoInput): Evolucao {
  const parsed = criarEvolucaoSchema.parse(input)
  const id = uuidv7()
  db.insert(prontuarioEvolucao)
    .values({
      id,
      pacienteId: parsed.pacienteId,
      conteudo: parsed.conteudo,
      dataSessao: parsed.dataSessao,
      tipo: parsed.tipo,
      createdAt: new Date().toISOString()
    })
    .run()
  return obterEvolucaoOuFalhar(db, id)
}

/**
 * Nunca UPDATE — sempre INSERT de uma linha nova com `retificaId` apontando
 * pra original (CLAUDE.md invariante de dado #1, reforçado por trigger
 * SQLite). `pacienteId` vem da entrada original, não do input — impede
 * retificar pra dentro do prontuário de outro paciente por engano/malícia.
 * Retificar uma retificação é permitido de propósito (cadeia).
 */
export function retificarEvolucao(db: PsiTrackDatabase, input: RetificarEvolucaoInput): Evolucao {
  const parsed = retificarEvolucaoSchema.parse(input)
  const original = obterEvolucaoOuFalhar(db, parsed.retificaId)

  const id = uuidv7()
  db.insert(prontuarioEvolucao)
    .values({
      id,
      pacienteId: original.pacienteId,
      conteudo: parsed.conteudo,
      dataSessao: parsed.dataSessao,
      tipo: parsed.tipo,
      retificaId: parsed.retificaId,
      motivoRetificacao: parsed.motivoRetificacao,
      createdAt: new Date().toISOString()
    })
    .run()
  return obterEvolucaoOuFalhar(db, id)
}
