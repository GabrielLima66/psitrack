/**
 * Cópia deliberada da forma dos DTOs de electron/preload/index.ts — não é
 * `import type` de lá porque essa fronteira entre projetos TS (composite:
 * tsconfig.web.json só inclui src/**, tsconfig.node.json inclui
 * electron/preload/**) se mostrou instável ao importar de vários arquivos
 * diferentes (funcionava de um só, quebrava com três — TS6307). Mesma
 * lógica de duplicação intencional já usada em recovery-key-input.ts.
 */

export type StatusPaciente = 'ativo' | 'pausado' | 'encerrado'
export type MotivoEncerramento = 'alta' | 'abandono' | 'encaminhamento' | 'outro'
export type OrigemPaciente = 'indicacao' | 'convenio' | 'redes' | 'outro'
export type ParentescoResponsavel = 'mae' | 'pai' | 'avo' | 'tutor' | 'outro'

export interface Paciente {
  id: string
  nome: string
  nomeSocial: string | null
  nomeBusca: string
  dataNascimento: string | null
  cpf: string | null
  telefone: string | null
  email: string | null
  status: StatusPaciente
  motivoEncerramento: MotivoEncerramento | null
  statusAlteradoEm: string | null
  origem: OrigemPaciente | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface PacienteComUltimaSessao extends Paciente {
  ultimaSessao: string | null
}

export interface PacienteInput {
  nome: string
  nomeSocial?: string | null
  dataNascimento?: string | null
  cpf?: string | null
  telefone?: string | null
  email?: string | null
  origem?: OrigemPaciente | null
}

export interface AlterarStatusInput {
  status: StatusPaciente
  motivoEncerramento?: MotivoEncerramento | null
}

export interface ListarPacientesOptions {
  status?: StatusPaciente
  arquivados?: boolean
  busca?: string
}

export interface Responsavel {
  id: string
  pacienteId: string
  nome: string
  cpf: string | null
  parentesco: ParentescoResponsavel
  telefone: string | null
  email: string | null
  principal: boolean
  pagador: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ResponsavelInput {
  nome: string
  cpf?: string | null
  parentesco: ParentescoResponsavel
  telefone?: string | null
  email?: string | null
  principal?: boolean
  pagador?: boolean
}

export type TipoEvolucao = 'sessao' | 'contato' | 'administrativo'

/** Sem updatedAt/deletedAt — nunca é atualizada nem apagada, correção é `retificaId` apontando pra original. */
export interface Evolucao {
  id: string
  pacienteId: string
  conteudo: string
  retificaId: string | null
  dataSessao: string
  tipo: TipoEvolucao
  motivoRetificacao: string | null
  createdAt: string
}

export interface CriarEvolucaoInput {
  pacienteId: string
  conteudo: string
  dataSessao: string
  tipo: TipoEvolucao
}

export interface RetificarEvolucaoInput {
  retificaId: string
  conteudo: string
  dataSessao: string
  tipo: TipoEvolucao
  motivoRetificacao: string
}
