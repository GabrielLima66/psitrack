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
}

export interface RetificarEvolucaoInput {
  retificaId: string
  conteudo: string
  dataSessao: string
  tipo: TipoEvolucao
  motivoRetificacao: string
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
    restaurar: (id: string): Promise<IpcResult> => ipcRenderer.invoke('paciente:restaurar', id)
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
  }
}

export type PsiTrackApi = typeof api

contextBridge.exposeInMainWorld('psitrack', api)
