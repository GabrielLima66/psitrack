import { and, eq, getTableColumns, isNotNull, isNull, like, sql } from 'drizzle-orm'
import { z } from 'zod'
import { cpfSchema } from '../cpf'
import type { PsiTrackDatabase } from '../connection'
import { pacientes, prontuarioEvolucao } from '../schema'
import { encerrarAgendaDoPaciente } from './sessao'
import { utcParaDataLocal } from '../timezone'
import { uuidv7 } from '../uuidv7'

/** Compartilhado por escrita (grava em `nomeBusca`) e consulta (normaliza o termo buscado). SQLite não ignora acento em LIKE. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function computeNomeBusca(nome: string, nomeSocial?: string | null): string {
  return normalizarBusca([nome, nomeSocial].filter(Boolean).join(' '))
}

const STATUS_VALUES = ['ativo', 'pausado', 'encerrado'] as const
const MOTIVO_ENCERRAMENTO_VALUES = ['alta', 'abandono', 'encaminhamento', 'outro'] as const
const ORIGEM_VALUES = ['indicacao', 'convenio', 'redes', 'outro'] as const

const dataNascimentoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento inválida.')
  .refine((value) => value <= utcParaDataLocal(new Date().toISOString()), 'Data de nascimento não pode ser no futuro.')

/**
 * Usado tanto pra criar quanto pra editar — o formulário sempre manda o
 * conjunto completo de campos editáveis (não é PATCH parcial), `null`
 * limpa um campo opcional, `undefined`/ausente também é tratado como "sem
 * valor". Isso evita a ambiguidade de um partial() de verdade (indistinguível
 * entre "não mandou" e "mandou undefined").
 */
export const pacienteInputSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório.'),
  nomeSocial: z.string().trim().min(1).nullish(),
  dataNascimento: dataNascimentoSchema.nullish(),
  cpf: cpfSchema.nullish(),
  telefone: z.string().trim().min(1).nullish(),
  email: z.email('E-mail inválido.').nullish(),
  origem: z.enum(ORIGEM_VALUES).nullish()
})
export type PacienteInput = z.infer<typeof pacienteInputSchema>

export const alterarStatusSchema = z
  .object({
    status: z.enum(STATUS_VALUES),
    motivoEncerramento: z.enum(MOTIVO_ENCERRAMENTO_VALUES).nullish()
  })
  .refine((v) => v.status !== 'encerrado' || v.motivoEncerramento != null, {
    message: 'Motivo de encerramento é obrigatório.',
    path: ['motivoEncerramento']
  })
export type AlterarStatusInput = z.infer<typeof alterarStatusSchema>

export type Paciente = typeof pacientes.$inferSelect

function cpfJaExiste(db: PsiTrackDatabase, cpf: string, excludingId?: string): boolean {
  return db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.cpf, cpf), isNull(pacientes.deletedAt)))
    .all()
    .some((row) => row.id !== excludingId)
}

export function obterPaciente(db: PsiTrackDatabase, id: string): Paciente | undefined {
  return db.select().from(pacientes).where(eq(pacientes.id, id)).get()
}

function obterPacienteOuFalhar(db: PsiTrackDatabase, id: string): Paciente {
  const row = obterPaciente(db, id)
  if (!row) throw new Error('Paciente não encontrado.')
  return row
}

export function criarPaciente(db: PsiTrackDatabase, input: PacienteInput): Paciente {
  const parsed = pacienteInputSchema.parse(input)
  if (parsed.cpf && cpfJaExiste(db, parsed.cpf)) {
    throw new Error('Já existe um paciente ativo com esse CPF.')
  }

  const now = new Date().toISOString()
  const id = uuidv7()
  db.insert(pacientes)
    .values({
      id,
      nome: parsed.nome,
      nomeSocial: parsed.nomeSocial ?? null,
      nomeBusca: computeNomeBusca(parsed.nome, parsed.nomeSocial),
      dataNascimento: parsed.dataNascimento ?? null,
      cpf: parsed.cpf ?? null,
      telefone: parsed.telefone ?? null,
      email: parsed.email ?? null,
      origem: parsed.origem ?? null,
      createdAt: now,
      updatedAt: now
    })
    .run()

  return obterPacienteOuFalhar(db, id)
}

export function atualizarPaciente(db: PsiTrackDatabase, id: string, input: PacienteInput): Paciente {
  obterPacienteOuFalhar(db, id) // 404 cedo, com mensagem clara
  const parsed = pacienteInputSchema.parse(input)
  if (parsed.cpf && cpfJaExiste(db, parsed.cpf, id)) {
    throw new Error('Já existe um paciente ativo com esse CPF.')
  }

  db.update(pacientes)
    .set({
      nome: parsed.nome,
      nomeSocial: parsed.nomeSocial ?? null,
      nomeBusca: computeNomeBusca(parsed.nome, parsed.nomeSocial),
      dataNascimento: parsed.dataNascimento ?? null,
      cpf: parsed.cpf ?? null,
      telefone: parsed.telefone ?? null,
      email: parsed.email ?? null,
      origem: parsed.origem ?? null,
      updatedAt: new Date().toISOString()
    })
    .where(eq(pacientes.id, id))
    .run()

  return obterPacienteOuFalhar(db, id)
}

/**
 * Encerrar o paciente fecha a agenda dele junto (D-mesmo raciocínio de
 * `encerrarSerie`): sem isso a agenda continuaria gerando ocorrências
 * futuras pra alguém que não está mais em atendimento. As duas escritas
 * (status do paciente + fechamento da agenda) são uma transação só —
 * nunca um paciente "encerrado" com agenda futura ainda aberta, nem
 * vice-versa se algo falhar no meio.
 */
export function alterarStatusPaciente(db: PsiTrackDatabase, id: string, input: AlterarStatusInput): Paciente {
  obterPacienteOuFalhar(db, id)
  const parsed = alterarStatusSchema.parse(input)
  const now = new Date().toISOString()

  const executar = db.$client.transaction((): Paciente => {
    db.update(pacientes)
      .set({
        status: parsed.status,
        motivoEncerramento: parsed.status === 'encerrado' ? (parsed.motivoEncerramento ?? null) : null,
        statusAlteradoEm: now,
        updatedAt: now
      })
      .where(eq(pacientes.id, id))
      .run()

    if (parsed.status === 'encerrado') {
      encerrarAgendaDoPaciente(db, id, utcParaDataLocal(now))
    }

    return obterPacienteOuFalhar(db, id)
  })

  return executar()
}

/** Soft delete — nenhuma linha é removida do banco (CLAUDE.md invariante de dado #5). */
export function arquivarPaciente(db: PsiTrackDatabase, id: string): void {
  obterPacienteOuFalhar(db, id)
  db.update(pacientes)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(pacientes.id, id))
    .run()
}

export function restaurarPaciente(db: PsiTrackDatabase, id: string): void {
  const existing = obterPacienteOuFalhar(db, id)
  if (existing.cpf && cpfJaExiste(db, existing.cpf, id)) {
    throw new Error('Já existe outro paciente ativo com esse CPF — não é possível restaurar.')
  }
  db.update(pacientes)
    .set({ deletedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(pacientes.id, id))
    .run()
}

export interface ListarPacientesOptions {
  status?: (typeof STATUS_VALUES)[number]
  /** true = só arquivados; default/false = só ativos (não-deletados). */
  arquivados?: boolean
  busca?: string
}

export type PacienteComUltimaSessao = Paciente & { ultimaSessao: string | null }

/**
 * `ultimaSessao` é subquery correlacionada, não JOIN+GROUP BY — mais simples
 * de ler e o volume por paciente é baixo o bastante pra não precisar
 * otimizar. Sempre null até a Etapa 7 existir de verdade (prontuario_evolucao
 * fica vazia até lá), mas a coluna já é real desde já.
 */
export function listarPacientes(db: PsiTrackDatabase, options: ListarPacientesOptions = {}): PacienteComUltimaSessao[] {
  const conditions = [options.arquivados ? isNotNull(pacientes.deletedAt) : isNull(pacientes.deletedAt)]
  if (options.status) conditions.push(eq(pacientes.status, options.status))
  if (options.busca) conditions.push(like(pacientes.nomeBusca, `%${normalizarBusca(options.busca)}%`))

  return db
    .select({
      ...getTableColumns(pacientes),
      // Subquery correlacionada: precisa qualificar "pacientes"."id" explicitamente
      // via sql.raw — interpolar ${pacientes.id} normal aqui gera coluna sem
      // prefixo de tabela, que dentro do subselect resolve pra
      // prontuario_evolucao.id (mesmo nome de coluna), não pacientes.id.
      ultimaSessao: sql<string | null>`(
        select max(${prontuarioEvolucao.dataSessao})
        from ${prontuarioEvolucao}
        where ${prontuarioEvolucao.pacienteId} = ${sql.raw('"pacientes"."id"')}
      )`.as('ultima_sessao')
    })
    .from(pacientes)
    .where(and(...conditions))
    .all()
}
