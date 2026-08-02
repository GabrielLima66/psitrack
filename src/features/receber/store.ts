import { create } from 'zustand'
import { hojeLocal } from '../agenda/tempo'
import { escolherPagadorPadrao, type PagadorCandidato } from '../pacientes/pagador'
import type { ContratoPreco, LancamentoComPaciente, MeioPagamento, RelatorioMensal } from './types'

interface ReceberStoreState {
  loading: boolean
  error: string | null
  pendentes: LancamentoComPaciente[]
  contratos: Record<string, ContratoPreco | null>
  selecionados: Record<string, string[]>
  registrandoPacienteId: string | null
  registrandoBusy: boolean
  pagadorPadrao: PagadorCandidato | null

  competenciaRelatorio: string
  relatorio: RelatorioMensal | null
  relatorioBusy: boolean
  relatorioError: string | null

  carregar: () => Promise<void>
  toggleSelecionado: (pacienteId: string, lancamentoId: string) => void
  abrirRegistrar: (pacienteId: string) => Promise<void>
  fecharRegistrar: () => void
  registrarPagamento: (
    pacienteId: string,
    input: { data: string; meio: MeioPagamento; pagadorNome: string; pagadorCpf?: string | null }
  ) => Promise<boolean>

  setCompetenciaRelatorio: (competencia: string) => void
  carregarRelatorio: () => Promise<void>
  exportarCsv: () => Promise<string | null>
}

/** Modalidade `mensal` pré-seleciona a competência inteira; `avulso` (ou sem contrato) começa sem nada selecionado (SPEC-fase-2.md §7). */
function selecaoPadrao(pendentes: LancamentoComPaciente[], contratos: Record<string, ContratoPreco | null>): Record<string, string[]> {
  const porPaciente: Record<string, string[]> = {}
  for (const l of pendentes) {
    if (!porPaciente[l.pacienteId]) porPaciente[l.pacienteId] = []
    if (contratos[l.pacienteId]?.modalidade === 'mensal') porPaciente[l.pacienteId]!.push(l.id)
  }
  return porPaciente
}

export const useReceberStore = create<ReceberStoreState>((set, get) => ({
  loading: false,
  error: null,
  pendentes: [],
  contratos: {},
  selecionados: {},
  registrandoPacienteId: null,
  registrandoBusy: false,
  pagadorPadrao: null,

  competenciaRelatorio: hojeLocal().slice(0, 7),
  relatorio: null,
  relatorioBusy: false,
  relatorioError: null,

  carregar: async () => {
    set({ loading: true, error: null })
    const result = await window.psitrack.lancamento.listarPendentesTodos()
    if (!result.ok) {
      set({ loading: false, error: result.error })
      return
    }
    const pacienteIds = [...new Set(result.lancamentos.map((l) => l.pacienteId))]
    const hoje = hojeLocal()
    const contratosEntries = await Promise.all(
      pacienteIds.map(async (id) => {
        const r = await window.psitrack.contrato.vigente(id, hoje)
        return [id, r.ok ? r.contrato : null] as const
      })
    )
    const contratos = Object.fromEntries(contratosEntries)
    set({
      loading: false,
      pendentes: result.lancamentos,
      contratos,
      selecionados: selecaoPadrao(result.lancamentos, contratos)
    })
  },

  toggleSelecionado: (pacienteId, lancamentoId) =>
    set((state) => {
      const atuais = state.selecionados[pacienteId] ?? []
      const novos = atuais.includes(lancamentoId) ? atuais.filter((id) => id !== lancamentoId) : [...atuais, lancamentoId]
      return { selecionados: { ...state.selecionados, [pacienteId]: novos } }
    }),

  abrirRegistrar: async (pacienteId) => {
    set({ registrandoPacienteId: pacienteId, pagadorPadrao: null })
    const [pacienteResult, responsaveisResult] = await Promise.all([
      window.psitrack.paciente.obter(pacienteId),
      window.psitrack.responsavel.listar(pacienteId)
    ])
    if (!pacienteResult.ok || !pacienteResult.paciente) return
    const paciente = pacienteResult.paciente
    const responsaveis = responsaveisResult.ok ? responsaveisResult.responsaveis : []
    set({ pagadorPadrao: escolherPagadorPadrao({ nome: paciente.nome, cpf: paciente.cpf }, responsaveis) })
  },
  fecharRegistrar: () => set({ registrandoPacienteId: null, pagadorPadrao: null }),

  registrarPagamento: async (pacienteId, input) => {
    const lancamentoIds = get().selecionados[pacienteId] ?? []
    if (lancamentoIds.length === 0) return false
    set({ registrandoBusy: true, error: null })
    const result = await window.psitrack.pagamento.registrar(pacienteId, { ...input, lancamentoIds })
    set({ registrandoBusy: false })
    if (!result.ok) {
      set({ error: result.error })
      return false
    }
    set({ registrandoPacienteId: null })
    await Promise.all([get().carregar(), get().carregarRelatorio()])
    return true
  },

  setCompetenciaRelatorio: (competencia) => set({ competenciaRelatorio: competencia }),

  carregarRelatorio: async () => {
    set({ relatorioBusy: true, relatorioError: null })
    const result = await window.psitrack.relatorio.mensal(get().competenciaRelatorio)
    if (result.ok) {
      set({ relatorioBusy: false, relatorio: result.relatorio })
    } else {
      set({ relatorioBusy: false, relatorioError: result.error })
    }
  },

  exportarCsv: async () => {
    const result = await window.psitrack.relatorio.exportarCsv(get().competenciaRelatorio)
    if (!result.ok) {
      set({ relatorioError: result.error })
      return null
    }
    return result.cancelado ? null : (result.caminho ?? null)
  }
}))
