import { create } from 'zustand'
import type {
  AlterarStatusInput,
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
  formError: null,
  formBusy: false,

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
    set({ screen: 'form', pacienteEmEdicao: null, responsaveis: [], evolucoes: [], formError: null }),

  abrirEdicaoPaciente: async (paciente) => {
    set({ screen: 'form', pacienteEmEdicao: paciente, responsaveis: [], evolucoes: [], formError: null })
    const [responsaveis, evolucoes] = await Promise.all([
      window.psitrack.responsavel.listar(paciente.id),
      window.psitrack.evolucao.listar(paciente.id)
    ])
    if (responsaveis.ok) set({ responsaveis: responsaveis.responsaveis })
    if (evolucoes.ok) set({ evolucoes: evolucoes.evolucoes })
  },

  voltarParaLista: () => {
    set({ screen: 'lista', pacienteEmEdicao: null, responsaveis: [], evolucoes: [] })
    void get().carregarPacientes()
  },

  salvarPaciente: async (input) => {
    set({ formBusy: true, formError: null })
    const existente = get().pacienteEmEdicao
    const result = existente
      ? await window.psitrack.paciente.atualizar(existente.id, input)
      : await window.psitrack.paciente.criar(input)

    if (result.ok) {
      set({ formBusy: false, pacienteEmEdicao: result.paciente })
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
  }
}))
