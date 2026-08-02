import { create } from 'zustand'
import type { ContratoPrecoInput, Recorrencia, RecorrenciaInput } from '../agenda/types'
import type {
  AlterarStatusInput,
  Anotacao,
  AnotacaoInput,
  CriarEvolucaoInput,
  Evolucao,
  ListarPacientesOptions,
  Paciente,
  PacienteComUltimaSessao,
  PacienteInput,
  RetificarEvolucaoInput,
  Responsavel,
  ResponsavelInput
} from './types'

export type PacientesScreen = 'lista' | 'form'

function hojeLocalIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function contratoRascunhoVazio(): ContratoPrecoInput {
  return { modalidade: 'avulso', valorCentavos: 0, politicaFalta: 'cobra_sem_aviso', vigenciaInicio: hojeLocalIso() }
}

interface PacientesStoreState {
  screen: PacientesScreen
  pacientes: PacienteComUltimaSessao[]
  loading: boolean
  listError: string | null

  filtroStatus: ListarPacientesOptions['status'] | undefined
  filtroArquivados: boolean
  busca: string

  pacienteEmEdicao: Paciente | null // null = criando um novo
  responsaveis: Responsavel[]
  evolucoes: Evolucao[]
  anotacoes: Anotacao[]
  formError: string | null
  formBusy: boolean

  carregarPacientes: () => Promise<void>
  setFiltroStatus: (status: ListarPacientesOptions['status'] | undefined) => void
  setFiltroArquivados: (arquivados: boolean) => void
  setBusca: (busca: string) => void

  abrirNovoPaciente: () => void
  abrirEdicaoPaciente: (paciente: Paciente) => Promise<void>
  voltarParaLista: () => void

  salvarPaciente: (input: PacienteInput) => Promise<boolean>
  alterarStatus: (input: AlterarStatusInput) => Promise<boolean>
  arquivar: (id: string) => Promise<void>
  restaurar: (id: string) => Promise<void>

  criarResponsavel: (input: ResponsavelInput) => Promise<void>
  atualizarResponsavel: (id: string, input: ResponsavelInput) => Promise<void>
  removerResponsavel: (id: string) => Promise<void>

  criarEvolucao: (input: CriarEvolucaoInput) => Promise<boolean>
  retificarEvolucao: (input: RetificarEvolucaoInput) => Promise<boolean>

  criarAnotacao: (input: AnotacaoInput) => Promise<void>
  atualizarAnotacao: (id: string, input: AnotacaoInput) => Promise<void>
  excluirAnotacao: (id: string) => Promise<void>

  // Atendimento (Etapa 11/D24): horários fixos + contrato inicial, só existem
  // como rascunho ENQUANTO o paciente ainda não foi salvo — depois de salvo,
  // viram `recorrenciasPaciente` (persistidas) e o contrato não é mais
  // editado por aqui (reajuste é Etapa 12, aba Financeiro).
  recorrenciasRascunho: RecorrenciaInput[]
  contratoRascunho: ContratoPrecoInput
  recorrenciasPaciente: Recorrencia[]

  adicionarRecorrenciaRascunho: (input: RecorrenciaInput) => void
  removerRecorrenciaRascunho: (index: number) => void
  setContratoRascunho: (contrato: ContratoPrecoInput) => void

  adicionarRecorrenciaExistente: (input: RecorrenciaInput) => Promise<void>
  encerrarRecorrenciaExistente: (id: string, vigenciaFim: string) => Promise<void>

  // Atalho "registrar evolução" clicado a partir da agenda (Etapa 11).
  prefillEvolucao: { sessaoId: string; dataSessao: string } | null
  abrirParaRegistrarEvolucao: (pacienteId: string, sessaoId: string, dataSessaoLocal: string) => Promise<void>
  limparPrefillEvolucao: () => void
}

export const usePacientesStore = create<PacientesStoreState>((set, get) => ({
  screen: 'lista',
  pacientes: [],
  loading: false,
  listError: null,

  filtroStatus: 'ativo',
  filtroArquivados: false,
  busca: '',

  pacienteEmEdicao: null,
  responsaveis: [],
  evolucoes: [],
  anotacoes: [],
  formError: null,
  formBusy: false,

  recorrenciasRascunho: [],
  contratoRascunho: contratoRascunhoVazio(),
  recorrenciasPaciente: [],
  prefillEvolucao: null,

  carregarPacientes: async () => {
    set({ loading: true, listError: null })
    const { filtroStatus, filtroArquivados, busca } = get()
    const result = await window.psitrack.paciente.listar({
      status: filtroArquivados ? undefined : filtroStatus,
      arquivados: filtroArquivados,
      busca: busca.trim() || undefined
    })
    if (result.ok) {
      set({ loading: false, pacientes: result.pacientes })
    } else {
      set({ loading: false, listError: result.error })
    }
  },

  setFiltroStatus: (status) => {
    set({ filtroStatus: status })
    void get().carregarPacientes()
  },
  setFiltroArquivados: (arquivados) => {
    set({ filtroArquivados: arquivados })
    void get().carregarPacientes()
  },
  setBusca: (busca) => {
    set({ busca })
    void get().carregarPacientes()
  },

  abrirNovoPaciente: () =>
    set({
      screen: 'form',
      pacienteEmEdicao: null,
      responsaveis: [],
      evolucoes: [],
      anotacoes: [],
      formError: null,
      recorrenciasRascunho: [],
      contratoRascunho: contratoRascunhoVazio(),
      recorrenciasPaciente: [],
      prefillEvolucao: null
    }),

  abrirEdicaoPaciente: async (paciente) => {
    set({
      screen: 'form',
      pacienteEmEdicao: paciente,
      responsaveis: [],
      evolucoes: [],
      anotacoes: [],
      formError: null,
      recorrenciasPaciente: [],
      prefillEvolucao: null
    })
    const [responsaveis, evolucoes, anotacoes, recorrencias] = await Promise.all([
      window.psitrack.responsavel.listar(paciente.id),
      window.psitrack.evolucao.listar(paciente.id),
      window.psitrack.anotacao.listar(paciente.id),
      window.psitrack.recorrencia.listar(paciente.id)
    ])
    if (responsaveis.ok) set({ responsaveis: responsaveis.responsaveis })
    if (evolucoes.ok) set({ evolucoes: evolucoes.evolucoes })
    if (anotacoes.ok) set({ anotacoes: anotacoes.anotacoes })
    if (recorrencias.ok) set({ recorrenciasPaciente: recorrencias.recorrencias })
  },

  voltarParaLista: () => {
    set({ screen: 'lista', pacienteEmEdicao: null, responsaveis: [], evolucoes: [], anotacoes: [] })
    void get().carregarPacientes()
  },

  salvarPaciente: async (input) => {
    set({ formBusy: true, formError: null })
    const existente = get().pacienteEmEdicao
    const result = existente
      ? await window.psitrack.paciente.atualizar(existente.id, input)
      : await window.psitrack.paciente.criarComAtendimento({
          paciente: input,
          recorrencias: get().recorrenciasRascunho,
          contrato: get().contratoRascunho
        })

    if (result.ok) {
      set({ formBusy: false, pacienteEmEdicao: result.paciente })
      if (!existente) {
        const recorrencias = await window.psitrack.recorrencia.listar(result.paciente.id)
        if (recorrencias.ok) set({ recorrenciasPaciente: recorrencias.recorrencias })
      }
      return true
    }
    set({ formBusy: false, formError: result.error })
    return false
  },

  alterarStatus: async (input) => {
    const existente = get().pacienteEmEdicao
    if (!existente) return false
    set({ formBusy: true, formError: null })
    const result = await window.psitrack.paciente.alterarStatus(existente.id, input)
    if (result.ok) {
      set({ formBusy: false, pacienteEmEdicao: result.paciente })
      return true
    }
    set({ formBusy: false, formError: result.error })
    return false
  },

  arquivar: async (id) => {
    await window.psitrack.paciente.arquivar(id)
    void get().carregarPacientes()
  },

  restaurar: async (id) => {
    await window.psitrack.paciente.restaurar(id)
    void get().carregarPacientes()
  },

  criarResponsavel: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    const result = await window.psitrack.responsavel.criar(paciente.id, input)
    if (result.ok) {
      const lista = await window.psitrack.responsavel.listar(paciente.id)
      if (lista.ok) set({ responsaveis: lista.responsaveis })
    } else {
      set({ formError: result.error })
    }
  },

  atualizarResponsavel: async (id, input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    const result = await window.psitrack.responsavel.atualizar(id, input)
    if (result.ok) {
      const lista = await window.psitrack.responsavel.listar(paciente.id)
      if (lista.ok) set({ responsaveis: lista.responsaveis })
    } else {
      set({ formError: result.error })
    }
  },

  removerResponsavel: async (id) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    await window.psitrack.responsavel.remover(id)
    const lista = await window.psitrack.responsavel.listar(paciente.id)
    if (lista.ok) set({ responsaveis: lista.responsaveis })
  },

  criarEvolucao: async (input) => {
    set({ formError: null })
    const result = await window.psitrack.evolucao.criar(input)
    if (!result.ok) {
      set({ formError: result.error })
      return false
    }
    const lista = await window.psitrack.evolucao.listar(input.pacienteId)
    if (lista.ok) set({ evolucoes: lista.evolucoes })
    return true
  },

  retificarEvolucao: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return false
    set({ formError: null })
    const result = await window.psitrack.evolucao.retificar(input)
    if (!result.ok) {
      set({ formError: result.error })
      return false
    }
    const lista = await window.psitrack.evolucao.listar(paciente.id)
    if (lista.ok) set({ evolucoes: lista.evolucoes })
    return true
  },

  criarAnotacao: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    const result = await window.psitrack.anotacao.criar(paciente.id, input)
    if (result.ok) {
      const lista = await window.psitrack.anotacao.listar(paciente.id)
      if (lista.ok) set({ anotacoes: lista.anotacoes })
    } else {
      set({ formError: result.error })
    }
  },

  atualizarAnotacao: async (id, input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    const result = await window.psitrack.anotacao.atualizar(id, input)
    if (result.ok) {
      const lista = await window.psitrack.anotacao.listar(paciente.id)
      if (lista.ok) set({ anotacoes: lista.anotacoes })
    } else {
      set({ formError: result.error })
    }
  },

  excluirAnotacao: async (id) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    await window.psitrack.anotacao.excluir(id)
    const lista = await window.psitrack.anotacao.listar(paciente.id)
    if (lista.ok) set({ anotacoes: lista.anotacoes })
  },

  adicionarRecorrenciaRascunho: (input) => set((state) => ({ recorrenciasRascunho: [...state.recorrenciasRascunho, input] })),

  removerRecorrenciaRascunho: (index) =>
    set((state) => ({ recorrenciasRascunho: state.recorrenciasRascunho.filter((_, i) => i !== index) })),

  setContratoRascunho: (contrato) => set({ contratoRascunho: contrato }),

  adicionarRecorrenciaExistente: async (input) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    const result = await window.psitrack.recorrencia.criar(paciente.id, input)
    if (result.ok) {
      const lista = await window.psitrack.recorrencia.listar(paciente.id)
      if (lista.ok) set({ recorrenciasPaciente: lista.recorrencias })
    } else {
      set({ formError: result.error })
    }
  },

  encerrarRecorrenciaExistente: async (id, vigenciaFim) => {
    const paciente = get().pacienteEmEdicao
    if (!paciente) return
    const result = await window.psitrack.recorrencia.encerrar(id, vigenciaFim)
    if (result.ok) {
      const lista = await window.psitrack.recorrencia.listar(paciente.id)
      if (lista.ok) set({ recorrenciasPaciente: lista.recorrencias })
    } else {
      set({ formError: result.error })
    }
  },

  abrirParaRegistrarEvolucao: async (pacienteId, sessaoId, dataSessaoLocal) => {
    const result = await window.psitrack.paciente.obter(pacienteId)
    if (!result.ok || !result.paciente) return
    await get().abrirEdicaoPaciente(result.paciente)
    set({ prefillEvolucao: { sessaoId, dataSessao: dataSessaoLocal } })
  },

  limparPrefillEvolucao: () => set({ prefillEvolucao: null })
}))
