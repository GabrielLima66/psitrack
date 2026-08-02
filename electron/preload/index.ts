import { contextBridge, ipcRenderer } from 'electron'

/**
 * Superfície exposta ao renderer. Só DTOs simples cruzam essa fronteira —
 * nunca a DEK, nunca um handle de banco, nunca um Buffer de chave.
 * (invariante de segurança #1 e #2 do CLAUDE.md)
 *
 * Os tipos de DTO abaixo são cópias deliberadas da forma das tabelas em
 * electron/main/db/schema.ts — não é `import type` de lá porque
 * tsconfig.web.json (projeto TS composite) não inclui electron/main/**,
 * só electron/preload/** e src/**; importar de lá arrastaria os arquivos
 * de main (que usam módulos Node-only) pro projeto do renderer. Mesma
 * lógica de duplicação intencional já usada em recovery-key-input.ts.
 */

type IpcResult<T extends object = Record<string, never>> = ({ ok: true } & T) | { ok: false; error: string }

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

/** `ultimaSessao` fica null até a Etapa 7 (evolução clínica) existir de verdade. */
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
  /** Preenchido pelo atalho "registrar evolução" clicado a partir da agenda (Etapa 11/D17). */
  sessaoId?: string | null
}

export interface RetificarEvolucaoInput {
  retificaId: string
  conteudo: string
  dataSessao: string
  tipo: TipoEvolucao
  motivoRetificacao: string
}

/**
 * NUNCA entra em export (CLAUDE.md invariante de dado #2 /
 * electron/main/db/repositories/export.ts). Ao contrário de Evolucao: TEM
 * updatedAt/deletedAt — edição e exclusão são livres aqui.
 */
export interface Anotacao {
  id: string
  pacienteId: string
  titulo: string | null
  conteudo: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface AnotacaoInput {
  titulo?: string | null
  conteudo: string
}

export type ModalidadeAtendimento = 'presencial' | 'online'

/** N por paciente — dois ou mais horários fixos na semana é caso normal (SPEC-fase-2.md §4.1). */
export interface Recorrencia {
  id: string
  pacienteId: string
  diaSemana: number // 0=dom … 6=sáb
  horaLocal: string // 'HH:MM' em America/Sao_Paulo
  duracaoMin: number
  modalidade: ModalidadeAtendimento
  vigenciaInicio: string
  vigenciaFim: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface RecorrenciaInput {
  diaSemana: number
  horaLocal: string
  duracaoMin?: number
  modalidade: ModalidadeAtendimento
  vigenciaInicio: string
}

export type StatusSessao = 'agendada' | 'realizada' | 'remarcada' | 'cancelada_profissional' | 'falta_sem_aviso' | 'falta_com_aviso'

/** Materializada (D13): ocorrência concreta, nunca regra virtual + exceção calculada em runtime. */
export interface Sessao {
  id: string
  pacienteId: string
  recorrenciaId: string | null
  inicioUtc: string
  duracaoMin: number
  modalidade: ModalidadeAtendimento
  status: StatusSessao
  statusAlteradoEm: string | null
  avisadaEm: string | null
  motivo: string | null
  remarcadaParaId: string | null
  observacao: string | null // logística, NUNCA clínico
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface SessaoComPaciente extends Sessao {
  pacienteNome: string
}

export interface CriarSessaoAvulsaInput {
  pacienteId: string
  dataLocal: string
  horaLocal: string
  duracaoMin?: number
  modalidade: ModalidadeAtendimento
  observacao?: string | null
}

export interface AlterarStatusSessaoInput {
  status: StatusSessao
  motivo?: string | null
  avisadaEm?: string | null
}

export interface RemarcarSessaoInput {
  dataLocal: string
  horaLocal: string
}

export type PoliticaFalta = 'cobra_sempre' | 'cobra_sem_aviso' | 'nunca_cobra'
export type ModalidadeContrato = 'avulso' | 'mensal' | 'encerrado'

export interface ContratoPreco {
  id: string
  pacienteId: string
  modalidade: ModalidadeContrato
  valorCentavos: number | null // null quando 'encerrado'
  politicaFalta: PoliticaFalta
  avisoMinimoHoras: number
  vigenciaInicio: string
  observacao: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ContratoPrecoInput {
  modalidade: 'avulso' | 'mensal'
  valorCentavos: number
  politicaFalta?: PoliticaFalta
  avisoMinimoHoras?: number
  vigenciaInicio: string
  observacao?: string | null
}

/** Paciente + N recorrências + contrato inicial, tudo numa transação (D24). */
export interface CriarPacienteComAtendimentoInput {
  paciente: PacienteInput
  recorrencias: RecorrenciaInput[]
  contrato: ContratoPrecoInput
}

const api = {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
  },
  vault: {
    status: (): Promise<{ exists: boolean }> => ipcRenderer.invoke('vault:status'),
    create: (password: string): Promise<IpcResult<{ recoveryKey: string }>> =>
      ipcRenderer.invoke('vault:create', password),
    unlock: (password: string): Promise<IpcResult> => ipcRenderer.invoke('vault:unlock', password),
    unlockWithRecovery: (recoveryKey: string): Promise<IpcResult> =>
      ipcRenderer.invoke('vault:unlockWithRecovery', recoveryKey),
    completeRecoverySetup: (newPassword: string): Promise<IpcResult<{ recoveryKey: string }>> =>
      ipcRenderer.invoke('vault:completeRecoverySetup', newPassword),
    lock: (): Promise<void> => ipcRenderer.invoke('vault:lock'),
    /** Disparado pelo main quando o auto-lock por inatividade trava a sessão. Devolve a função de cancelar a inscrição. */
    onLocked: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      ipcRenderer.on('vault:locked', listener)
      return () => ipcRenderer.removeListener('vault:locked', listener)
    }
  },
  paciente: {
    criar: (input: PacienteInput): Promise<IpcResult<{ paciente: Paciente }>> => ipcRenderer.invoke('paciente:criar', input),
    atualizar: (id: string, input: PacienteInput): Promise<IpcResult<{ paciente: Paciente }>> =>
      ipcRenderer.invoke('paciente:atualizar', id, input),
    alterarStatus: (id: string, input: AlterarStatusInput): Promise<IpcResult<{ paciente: Paciente }>> =>
      ipcRenderer.invoke('paciente:alterarStatus', id, input),
    obter: (id: string): Promise<IpcResult<{ paciente: Paciente | null }>> => ipcRenderer.invoke('paciente:obter', id),
    listar: (options?: ListarPacientesOptions): Promise<IpcResult<{ pacientes: PacienteComUltimaSessao[] }>> =>
      ipcRenderer.invoke('paciente:listar', options),
    arquivar: (id: string): Promise<IpcResult> => ipcRenderer.invoke('paciente:arquivar', id),
    restaurar: (id: string): Promise<IpcResult> => ipcRenderer.invoke('paciente:restaurar', id),
    criarComAtendimento: (input: CriarPacienteComAtendimentoInput): Promise<IpcResult<{ paciente: Paciente }>> =>
      ipcRenderer.invoke('paciente:criarComAtendimento', input)
  },
  responsavel: {
    listar: (pacienteId: string): Promise<IpcResult<{ responsaveis: Responsavel[] }>> =>
      ipcRenderer.invoke('responsavel:listar', pacienteId),
    criar: (pacienteId: string, input: ResponsavelInput): Promise<IpcResult<{ responsavel: Responsavel }>> =>
      ipcRenderer.invoke('responsavel:criar', pacienteId, input),
    atualizar: (id: string, input: ResponsavelInput): Promise<IpcResult<{ responsavel: Responsavel }>> =>
      ipcRenderer.invoke('responsavel:atualizar', id, input),
    remover: (id: string): Promise<IpcResult> => ipcRenderer.invoke('responsavel:remover', id)
  },
  evolucao: {
    criar: (input: CriarEvolucaoInput): Promise<IpcResult<{ evolucao: Evolucao }>> => ipcRenderer.invoke('evolucao:criar', input),
    listar: (pacienteId: string): Promise<IpcResult<{ evolucoes: Evolucao[] }>> =>
      ipcRenderer.invoke('evolucao:listar', pacienteId),
    retificar: (input: RetificarEvolucaoInput): Promise<IpcResult<{ evolucao: Evolucao }>> =>
      ipcRenderer.invoke('evolucao:retificar', input)
  },
  anotacao: {
    listar: (pacienteId: string): Promise<IpcResult<{ anotacoes: Anotacao[] }>> =>
      ipcRenderer.invoke('anotacao:listar', pacienteId),
    criar: (pacienteId: string, input: AnotacaoInput): Promise<IpcResult<{ anotacao: Anotacao }>> =>
      ipcRenderer.invoke('anotacao:criar', pacienteId, input),
    atualizar: (id: string, input: AnotacaoInput): Promise<IpcResult<{ anotacao: Anotacao }>> =>
      ipcRenderer.invoke('anotacao:atualizar', id, input),
    excluir: (id: string): Promise<IpcResult> => ipcRenderer.invoke('anotacao:excluir', id)
  },
  recorrencia: {
    listar: (pacienteId: string): Promise<IpcResult<{ recorrencias: Recorrencia[] }>> =>
      ipcRenderer.invoke('recorrencia:listar', pacienteId),
    criar: (pacienteId: string, input: RecorrenciaInput): Promise<IpcResult<{ recorrencia: Recorrencia }>> =>
      ipcRenderer.invoke('recorrencia:criar', pacienteId, input),
    encerrar: (id: string, vigenciaFim: string): Promise<IpcResult<{ recorrencia: Recorrencia }>> =>
      ipcRenderer.invoke('recorrencia:encerrar', id, vigenciaFim)
  },
  sessao: {
    listarPeriodo: (inicioUtc: string, fimUtc: string): Promise<IpcResult<{ sessoes: SessaoComPaciente[] }>> =>
      ipcRenderer.invoke('sessao:listarPeriodo', inicioUtc, fimUtc),
    criarAvulsa: (input: CriarSessaoAvulsaInput): Promise<IpcResult<{ sessao: Sessao }>> =>
      ipcRenderer.invoke('sessao:criarAvulsa', input),
    alterarStatus: (id: string, input: AlterarStatusSessaoInput): Promise<IpcResult<{ sessao: Sessao }>> =>
      ipcRenderer.invoke('sessao:alterarStatus', id, input),
    remarcar: (id: string, input: RemarcarSessaoInput): Promise<IpcResult<{ origem: Sessao; destino: Sessao }>> =>
      ipcRenderer.invoke('sessao:remarcar', id, input),
    sobreposicao: (inicioUtc: string, duracaoMin: number, excludingId?: string): Promise<IpcResult<{ colisoes: SessaoComPaciente[] }>> =>
      ipcRenderer.invoke('sessao:sobreposicao', inicioUtc, duracaoMin, excludingId)
  }
}

export type PsiTrackApi = typeof api

contextBridge.exposeInMainWorld('psitrack', api)
