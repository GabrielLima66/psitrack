import { create } from 'zustand'
import type { BackupListado, BackupVerificationResult, PreviewPurga, RegistroRestauracao, ResultadoPurga } from './types'

interface ConfiguracoesStoreState {
  backups: BackupListado[]
  loading: boolean
  error: string | null
  criando: boolean
  verificando: Record<string, BackupVerificationResult>
  verificandoBusy: string | null
  restaurando: string | null
  ultimaRestauracao: RegistroRestauracao | null
  versao: string | null

  // Destino externo (Etapa 19) — D42: falha do destino nunca é erro
  // bloqueante, por isso fica em `avisoDestino` (aviso dispensável), não em
  // `error` (que a UI trata como falha da ação).
  destino: string | null
  ultimoBackupExternoEm: string | null
  configurandoDestino: boolean
  destinoError: string | null
  avisoDestino: string | null
  verificacaoDestino: BackupVerificationResult | null
  verificandoDestino: boolean

  // Retenção/purga (Etapa 20) — dry-run carregado junto com o resto da
  // tela; `ultimaPurga` só existe depois de um "Purgar agora" nesta sessão.
  previewPurga: PreviewPurga | null
  purgando: boolean
  purgaError: string | null
  ultimaPurga: ResultadoPurga | null

  carregar: () => Promise<void>
  criarBackup: () => Promise<void>
  verificar: (pasta: string) => Promise<void>
  restaurar: (pasta: string) => void

  configurarDestino: () => Promise<void>
  removerDestino: () => Promise<void>
  verificarDestino: () => Promise<void>

  executarPurga: () => Promise<void>
}

export const useConfiguracoesStore = create<ConfiguracoesStoreState>((set, get) => ({
  backups: [],
  loading: false,
  error: null,
  criando: false,
  verificando: {},
  verificandoBusy: null,
  restaurando: null,
  ultimaRestauracao: null,
  versao: null,

  destino: null,
  ultimoBackupExternoEm: null,
  configurandoDestino: false,
  destinoError: null,
  avisoDestino: null,
  verificacaoDestino: null,
  verificandoDestino: false,

  previewPurga: null,
  purgando: false,
  purgaError: null,
  ultimaPurga: null,

  carregar: async () => {
    set({ loading: true, error: null })
    const [backups, ultimaRestauracao, versao, configDestino, preview] = await Promise.all([
      window.psitrack.backup.listar(),
      window.psitrack.backup.ultimaRestauracao(),
      window.psitrack.app.getVersion(),
      window.psitrack.backup.obterConfigDestino(),
      window.psitrack.backup.previewPurga()
    ])
    set({
      loading: false,
      backups: backups.ok ? backups.backups : [],
      ultimaRestauracao: ultimaRestauracao.ok ? ultimaRestauracao.registro : null,
      versao,
      destino: configDestino.ok ? configDestino.destinoBackupExterno : null,
      ultimoBackupExternoEm: configDestino.ok ? configDestino.ultimoBackupExternoEm : null,
      previewPurga: preview.ok ? preview.preview : null,
      error: !backups.ok ? backups.error : null
    })
  },

  criarBackup: async () => {
    set({ criando: true, error: null, avisoDestino: null })
    const result = await window.psitrack.backup.criar()
    set({ criando: false })
    if (!result.ok) {
      set({ error: result.error })
      return
    }
    if (result.destinoOk === false) {
      set({ avisoDestino: `Backup local criado, mas não foi possível gravar no destino externo: ${result.destinoErro ?? 'motivo desconhecido'}.` })
    }
    await get().carregar()
  },

  verificar: async (pasta) => {
    set({ verificandoBusy: pasta })
    const result = await window.psitrack.backup.verificar(pasta)
    set((state) => ({
      verificandoBusy: null,
      verificando: result.ok ? { ...state.verificando, [pasta]: result.resultado } : state.verificando,
      error: !result.ok ? result.error : state.error
    }))
  },

  // Dispara e não espera: o app fecha e reabre sozinho assim que o restore
  // termina no main, então essa promise normalmente nunca chega a resolver
  // do lado do renderer (o processo morre antes da resposta IPC voltar).
  restaurar: (pasta) => {
    set({ restaurando: pasta, error: null })
    void window.psitrack.backup.restaurar(pasta)
  },

  configurarDestino: async () => {
    set({ configurandoDestino: true, destinoError: null })
    const result = await window.psitrack.backup.configurarDestino()
    set({ configurandoDestino: false })
    if (!result.ok) {
      set({ destinoError: result.error })
      return
    }
    if (result.cancelado) return
    set({ destino: result.destino })
  },

  removerDestino: async () => {
    const result = await window.psitrack.backup.removerDestino()
    if (!result.ok) {
      set({ destinoError: result.error })
      return
    }
    set({ destino: null, ultimoBackupExternoEm: null, verificacaoDestino: null })
  },

  verificarDestino: async () => {
    set({ verificandoDestino: true })
    const result = await window.psitrack.backup.verificarDestino()
    set({ verificandoDestino: false })
    if (!result.ok) {
      set({ destinoError: result.error })
      return
    }
    set({ verificacaoDestino: result.resultado })
  },

  executarPurga: async () => {
    set({ purgando: true, purgaError: null })
    const result = await window.psitrack.backup.executarPurga()
    set({ purgando: false })
    if (!result.ok) {
      set({ purgaError: result.error })
      return
    }
    set({ ultimaPurga: result.resultado })
    await get().carregar()
  }
}))
