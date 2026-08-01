import { sqliteTable, text, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

/**
 * Ainda não existe tela de paciente (Fase 0 proíbe) — esta tabela existe só
 * como âncora de FK pra `prontuario_evolucao`, mínima de propósito.
 * Timestamps em texto ISO-8601 UTC (CLAUDE.md invariante de dado #4), nunca
 * `integer` modo timestamp do Drizzle. ID é UUID v7, nunca autoincrement.
 */
export const pacientes = sqliteTable('pacientes', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at')
})

/**
 * Append-only de verdade, garantido por trigger SQLite (migration
 * 0001_prontuario_evolucao_append_only.sql), não só por convenção da
 * camada de aplicação. Por isso não tem `updated_at`/`deleted_at`: nada
 * aqui nunca é atualizado nem apagado — correção é `retifica_id` apontando
 * pra linha original.
 */
export const prontuarioEvolucao = sqliteTable('prontuario_evolucao', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id')
    .notNull()
    .references(() => pacientes.id),
  conteudo: text('conteudo').notNull(),
  retificaId: text('retifica_id').references((): AnySQLiteColumn => prontuarioEvolucao.id),
  createdAt: text('created_at').notNull()
})
