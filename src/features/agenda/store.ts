import { create } from 'zustand'
import { usePacientesStore } from '../pacientes/store'
import { useNavigationStore } from '../../store/navigation'
import { hojeLocal, inicioDaSemana, localParaUtc, somarDias, utcParaDataLocal } from './tempo'
import type {
  AlterarStatusSessaoInput,
  CriarSessaoAvulsaInput,
  RemarcarSessaoInput,
  SessaoComPaciente
} from './types'

export type VisaoAgenda = 'semana' | 'dia'

interface AgendaStoreState {
  visao: VisaoAgenda
  dataReferencia: string // YYYY-MM-DD local — âncora da semana/dia visível
  sessoes: SessaoComPaciente[]
  loading: boolean
  error: string | null
  sessaoSelecionadaId: string | null
  novaSessaoAberta: boolean
  pacientesDisponiveis: { id: string; nome: string }[]

  mudarVisao: (visao: VisaoAgenda) => void
  irParaHoje: () => void
  avancar: () => void
  voltar: () => void
  carregar: () => Promise<void>

  selecionarSessao: (id: string | null) => void
  abrirNovaSessao: () => Promise<void>
  fecharNovaSessao: () => void

  alterarStatus: (id: string, input: AlterarStatusSessaoInput) => Promise<boolean>
  remarcar: (id: string, input: RemarcarSessaoInput) => Promise<boolean>
  criarSessaoAvulsa: (input: CriarSessaoAvulsaInput) => Promise<boolean>
  registrarEvolucao: (sessao: SessaoComPaciente) => Promise<void>
}

/** Início/fim (UTC) da janela visível, a partir da âncora local e da visão atual. */
function janelaVisivel(dataReferencia: string, visao: VisaoAgenda): { inicioUtc: string; fimUtc: string } {
  if (visao === 'dia') {
    return { inicioUtc: localParaUtc(dataReferencia, '00:00'), fimUtc: localParaUtc(somarDias(dataReferencia, 1), '00:00') }
  }
  const domingo = inicioDaSemana(dataReferencia)
  return { inicioUtc: localParaUtc(domingo, '00:00'), fimUtc: localParaUtc(somarDias(domingo, 7), '00:00') }
}

export const useAgendaStore = create<AgendaStoreState>((set, get) => ({
  visao: 'semana',
  dataReferencia: hojeLocal(),
  sessoes: [],
  loading: false,
  error: null,
  sessaoSelecionadaId: null,
  novaSessaoAberta: false,
  pacientesDisponiveis: [],

  mudarVisao: (visao) => {
    set({ visao })
    void get().carregar()
  },

  irParaHoje: () => {
    set({ dataReferencia: hojeLocal() })
    void get().carregar()
  },

  avancar: () => {
    const passo = get().visao === 'dia' ? 1 : 7
    set((state) => ({ dataReferencia: somarDias(state.dataReferencia, passo) }))
    void get().carregar()
  },

  voltar: () => {
    const passo = get().visao === 'dia' ? -1 : -7
    set((state) => ({ dataReferencia: somarDias(state.dataReferencia, passo) }))
    void get().carregar()
  },

  carregar: async () => {
    set({ loading: true, error: null })
    const { inicioUtc, fimUtc } = janelaVisivel(get().dataReferencia, get().visao)
    const result = await window.psitrack.sessao.listarPeriodo(inicioUtc, fimUtc)
    if (result.ok) {
      set({ loading: false, sessoes: result.sessoes })
    } else {
      set({ loading: false, error: result.error })
    }
  },

  selecionarSessao: (id) => set({ sessaoSelecionadaId: id }),

  abrirNovaSessao: async () => {
    set({ novaSessaoAberta: true })
    const result = await window.psitrack.paciente.listar({ status: 'ativo' })
    if (result.ok) set({ pacientesDisponiveis: result.pacientes.map((p) => ({ id: p.id, nome: p.nome })) })
  },
  fecharNovaSessao: () => set({ novaSessaoAberta: false }),

  alterarStatus: async (id, input) => {
    const result = await window.psitrack.sessao.alterarStatus(id, input)
    if (result.ok) {
      await get().carregar()
      set({ sessaoSelecionadaId: null })
      return true
    }
    set({ error: result.error })
    return false
  },

  remarcar: async (id, input) => {
    const result = await window.psitrack.sessao.remarcar(id, input)
    if (result.ok) {
      await get().carregar()
      set({ sessaoSelecionadaId: null })
      return true
    }
    set({ error: result.error })
    return false
  },

  criarSessaoAvulsa: async (input) => {
    const result = await window.psitrack.sessao.criarAvulsa(input)
    if (result.ok) {
      await get().carregar()
      set({ novaSessaoAberta: false })
      return true
    }
    set({ error: result.error })
    return false
  },

  registrarEvolucao: async (sessao) => {
    const dataLocal = utcParaDataLocal(sessao.inicioUtc)
    await usePacientesStore.getState().abrirParaRegistrarEvolucao(sessao.pacienteId, sessao.id, dataLocal)
    set({ sessaoSelecionadaId: null })
    useNavigationStore.getState().irPara('pacientes')
  }
}))
