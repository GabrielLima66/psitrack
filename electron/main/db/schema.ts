import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

/**
 * Cadastro de paciente: identificação, contato e cobrança — nada de conteúdo
 * clínico aqui (SPEC-fase-1.md D1/D2). Idade é sempre derivada de
 * `dataNascimento` em runtime, nunca persistida (menoridade muda sozinha aos
 * 18 se fosse coluna). Timestamps em texto ISO-8601 UTC (CLAUDE.md
 * invariante de dado #4). ID é UUID v7, nunca autoincrement.
 */
export const pacientes = sqliteTable(
  'pacientes',
  {
    id: text('id').primaryKey(),
    nome: text('nome').notNull(),
    nomeSocial: text('nome_social'),
    nomeBusca: text('nome_busca').notNull(), // derivado de nome+nomeSocial, ver normalizarBusca()
    dataNascimento: text('data_nascimento'), // 'YYYY-MM-DD', sem hora nem fuso
    cpf: text('cpf'), // só dígitos, 11 chars — nullable de verdade (menor sem CPF existe)
    telefone: text('telefone'),
    email: text('email'),
    status: text('status').notNull().default('ativo').$type<'ativo' | 'pausado' | 'encerrado'>(),
    motivoEncerramento: text('motivo_encerramento').$type<'alta' | 'abandono' | 'encaminhamento' | 'outro'>(),
    statusAlteradoEm: text('status_alterado_em'),
    origem: text('origem').$type<'indicacao' | 'convenio' | 'redes' | 'outro'>(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (t) => [
    // Único só entre não-deletados: permite recadastro do mesmo CPF após soft delete.
    uniqueIndex('idx_pacientes_cpf')
      .on(t.cpf)
      .where(sql`${t.cpf} is not null and ${t.deletedAt} is null`),
    index('idx_pacientes_busca').on(t.nomeBusca),
    index('idx_pacientes_status').on(t.status, t.deletedAt)
  ]
)

/**
 * Responsável legal — N por paciente (guarda compartilhada é o caso comum).
 * `principal` é o contato preferencial; `pagador` é quem figura no recibo —
 * não são sempre a mesma pessoa (pai paga, mãe leva). Nenhuma trigger:
 * responsável é dado cadastral, edita e apaga à vontade como `pacientes`.
 */
export const pacienteResponsavel = sqliteTable(
  'paciente_responsavel',
  {
    id: text('id').primaryKey(),
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    nome: text('nome').notNull(),
    cpf: text('cpf'),
    parentesco: text('parentesco').notNull().$type<'mae' | 'pai' | 'avo' | 'tutor' | 'outro'>(),
    telefone: text('telefone'),
    email: text('email'),
    principal: integer('principal', { mode: 'boolean' }).notNull().default(false),
    pagador: integer('pagador', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (t) => [index('idx_resp_paciente').on(t.pacienteId, t.deletedAt)]
)

/**
 * Append-only de verdade, garantido por trigger SQLite (migrations
 * 0001/0002), não só por convenção da camada de aplicação. Por isso não tem
 * `updated_at`/`deleted_at`: nada aqui nunca é atualizado nem apagado —
 * correção é `retifica_id` apontando pra linha original.
 * `dataSessao` ≠ `createdAt`: o registro pode ser digitado dias depois do
 * atendimento. Listagem/export ordenam por `dataSessao`; auditoria usa
 * `createdAt`.
 */
export const prontuarioEvolucao = sqliteTable('prontuario_evolucao', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id')
    .notNull()
    .references(() => pacientes.id),
  conteudo: text('conteudo').notNull(),
  retificaId: text('retifica_id').references((): AnySQLiteColumn => prontuarioEvolucao.id),
  dataSessao: text('data_sessao').notNull(), // 'YYYY-MM-DD'
  tipo: text('tipo').notNull().default('sessao').$type<'sessao' | 'contato' | 'administrativo'>(),
  motivoRetificacao: text('motivo_retificacao'), // obrigatório na app quando retificaId != null
  createdAt: text('created_at').notNull()
})

/**
 * NUNCA entra em export (CLAUDE.md invariante de dado #2) — a assimetria com
 * `prontuario_evolucao` é a feature, não um descuido: sem trigger, edita e
 * apaga à vontade, TEM updated_at/deleted_at (ao contrário da evolução).
 * Não "conserte" isso pra ficar simétrico com prontuario_evolucao.
 */
export const anotacaoPrivada = sqliteTable('anotacao_privada', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id')
    .notNull()
    .references(() => pacientes.id),
  titulo: text('titulo'),
  conteudo: text('conteudo').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at')
})
