import { create } from 'zustand'
import { hojeLocal } from '../agenda/tempo'
import type { MensagemTemplate, MensagemTemplateInput, SessaoConfirmacao } from './types'

interface MensagensStoreState {
  templates: MensagemTemplate[]
  confirmacoesHoje: SessaoConfirmacao[]
  /** Só overrides explícitos da usuária — o default (template `padrao`) é resolvido na UI, não guardado aqui. */
  templateSelecionadoPorSessao: Record<string, string | null>
  loading: boolean
  error: string | null
  enviandoSessaoId: string | null

  carregarTemplates: () => Promise<void>
  criarTemplate: (input: MensagemTemplateInput) => Promise<boolean>
  atualizarTemplate: (id: string, input: MensagemTemplateInput) => Promise<boolean>
  removerTemplate: (id: string) => Promise<void>

  carregarConfirmacoesHoje: () => Promise<void>
  selecionarTemplateParaSessao: (sessaoId: string, templateId: string | null) => void
  enviarConfirmacao: (sessaoId: string, telefone: string | null, texto: string) => Promise<boolean>
  marcarLembreteManualmente: (sessaoId: string) => Promise<void>
  desfazerLembrete: (sessaoId: string) => Promise<void>
}

export const useMensagensStore = create<MensagensStoreState>((set, get) => ({
  templates: [],
  confirmacoesHoje: [],
  templateSelecionadoPorSessao: {},
  loading: false,
  error: null,
  enviandoSessaoId: null,

  carregarTemplates: async () => {
    const result = await window.psitrack.mensagem.listarTemplates()
    if (result.ok) set({ templates: result.templates })
    else set({ error: result.error })
  },

  criarTemplate: async (input) => {
    const result = await window.psitrack.mensagem.criarTemplate(input)
    if (result.ok) {
      await get().carregarTemplates()
      return true
    }
    set({ error: result.error })
    return false
  },

  atualizarTemplate: async (id, input) => {
    const result = await window.psitrack.mensagem.atualizarTemplate(id, input)
    if (result.ok) {
      await get().carregarTemplates()
      return true
    }
    set({ error: result.error })
    return false
  },

  removerTemplate: async (id) => {
    const result = await window.psitrack.mensagem.removerTemplate(id)
    if (result.ok) await get().carregarTemplates()
    else set({ error: result.error })
  },

  carregarConfirmacoesHoje: async () => {
    set({ loading: true, error: null })
    const result = await window.psitrack.sessao.listarConfirmacaoDoDia(hojeLocal())
    if (result.ok) {
      set({ loading: false, confirmacoesHoje: result.sessoes, templateSelecionadoPorSessao: {} })
    } else {
      set({ loading: false, error: result.error })
    }
  },

  selecionarTemplateParaSessao: (sessaoId, templateId) =>
    set((state) => ({ templateSelecionadoPorSessao: { ...state.templateSelecionadoPorSessao, [sessaoId]: templateId } })),

  enviarConfirmacao: async (sessaoId, telefone, texto) => {
    set({ enviandoSessaoId: sessaoId, error: null })
    const result = await window.psitrack.mensagem.enviarConfirmacao(sessaoId, telefone, texto)
    set({ enviandoSessaoId: null })
    if (result.ok) {
      set((state) => ({
        confirmacoesHoje: state.confirmacoesHoje.map((s) =>
          s.id === sessaoId ? { ...s, lembreteEnviadoEm: result.sessao.lembreteEnviadoEm } : s
        )
      }))
      return true
    }
    set({ error: result.error })
    return false
  },

  marcarLembreteManualmente: async (sessaoId) => {
    const result = await window.psitrack.sessao.definirLembreteEnviado(sessaoId, true)
    if (result.ok) {
      set((state) => ({
        confirmacoesHoje: state.confirmacoesHoje.map((s) =>
          s.id === sessaoId ? { ...s, lembreteEnviadoEm: result.sessao.lembreteEnviadoEm } : s
        )
      }))
    } else {
      set({ error: result.error })
    }
  },

  desfazerLembrete: async (sessaoId) => {
    const result = await window.psitrack.sessao.definirLembreteEnviado(sessaoId, false)
    if (result.ok) {
      set((state) => ({
        confirmacoesHoje: state.confirmacoesHoje.map((s) =>
          s.id === sessaoId ? { ...s, lembreteEnviadoEm: result.sessao.lembreteEnviadoEm } : s
        )
      }))
    } else {
      set({ error: result.error })
    }
  }
}))
