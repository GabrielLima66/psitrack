import { create } from 'zustand'
import type {
  AlterarStatusInput,
  ListarPacientesOptions,
  Paciente,
  PacienteComUltimaSessao,
  PacienteInput,
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

  abrirNovoPaciente: () => set({ screen: 'form', pacienteEmEdicao: null, responsaveis: [], formError: null }),

  abrirEdicaoPaciente: async (paciente) => {
    set({ screen: 'form', pacienteEmEdicao: paciente, responsaveis: [], formError: null })
    const result = await window.psitrack.responsavel.listar(paciente.id)
    if (result.ok) set({ responsaveis: result.responsaveis })
  },

  voltarParaLista: () => {
    set({ screen: 'lista', pacienteEmEdicao: null, responsaveis: [] })
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
  }
}))
