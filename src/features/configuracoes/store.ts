import { create } from 'zustand'
import type {
  BackupListado,
  BackupVerificationResult,
  ExecucaoBackupAutomatico,
  PreviewPurga,
  RegistroRestauracao,
  ResultadoPurga
} from './types'

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

  // Scheduler automático (Etapa 21) — assinado uma vez a nível de App.tsx
  // (mesmo padrão de vault.onLocked em VaultFlow.tsx), mas o estado mora
  // aqui porque a tela de Configurações é quem mostra o histórico.
  historico: ExecucaoBackupAutomatico[]
  // D41: "nunca silenciosa" — só some com dispensarAvisoBackupAutomatico,
  // nunca sozinho, por isso não é um `error` comum (que a UI já trata como
  // transitório).
  avisoBackupAutomatico: ExecucaoBackupAutomatico | null
  fechandoComBackup: boolean

  // Atualização manual: nunca verifica/baixa sozinho, só a partir de clique
  // (invariante "sem rede" do CLAUDE.md) — ver electron/main/update.ts.
  atualizacaoStatus: 'ocioso' | 'verificando' | 'disponivel' | 'baixando' | 'erro'
  atualizacaoVersaoDisponivel: string | null
  atualizacaoProgresso: number
  atualizacaoError: string | null
  verificarAtualizacao: () => Promise<void>
  baixarEInstalarAtualizacao: () => Promise<void>
  registrarProgressoAtualizacao: (percentual: number) => void

  carregar: () => Promise<void>
  criarBackup: () => Promise<void>
  verificar: (pasta: string) => Promise<void>
  restaurar: (pasta: string) => void

  configurarDestino: () => Promise<void>
  removerDestino: () => Promise<void>
  verificarDestino: () => Promise<void>

  executarPurga: () => Promise<void>

  registrarResultadoAutomatico: (execucao: ExecucaoBackupAutomatico) => void
  dispensarAvisoBackupAutomatico: () => void
  mostrarOverlayFechamento: () => void
  pularFechamento: () => Promise<void>
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

  historico: [],
  avisoBackupAutomatico: null,
  fechandoComBackup: false,

  atualizacaoStatus: 'ocioso',
  atualizacaoVersaoDisponivel: null,
  atualizacaoProgresso: 0,
  atualizacaoError: null,

  carregar: async () => {
    set({ loading: true, error: null })
    const [backups, ultimaRestauracao, versao, configDestino, preview, historico] = await Promise.all([
      window.psitrack.backup.listar(),
      window.psitrack.backup.ultimaRestauracao(),
      window.psitrack.app.getVersion(),
      window.psitrack.backup.obterConfigDestino(),
      window.psitrack.backup.previewPurga(),
      window.psitrack.backup.historico()
    ])
    set({
      loading: false,
      backups: backups.ok ? backups.backups : [],
      ultimaRestauracao: ultimaRestauracao.ok ? ultimaRestauracao.registro : null,
      versao,
      destino: configDestino.ok ? configDestino.destinoBackupExterno : null,
      ultimoBackupExternoEm: configDestino.ok ? configDestino.ultimoBackupExternoEm : null,
      previewPurga: preview.ok ? preview.preview : null,
      historico: historico.ok ? historico.historico : [],
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
  },

  // Chamada pelo listener assinado em App.tsx (window.psitrack.backup.onResultadoAutomatico).
  registrarResultadoAutomatico: (execucao) => {
    set((state) => ({
      historico: [execucao, ...state.historico].slice(0, 10),
      fechandoComBackup: false,
      // D41: falha (total ou parcial no destino) vira aviso persistente —
      // sucesso completo não precisa incomodar ninguém.
      avisoBackupAutomatico: !execucao.localOk || execucao.destinoOk === false ? execucao : state.avisoBackupAutomatico
    }))
  },

  dispensarAvisoBackupAutomatico: () => set({ avisoBackupAutomatico: null }),

  // Chamada pelo listener de window.psitrack.backup.onAntesDeFechar.
  mostrarOverlayFechamento: () => set({ fechandoComBackup: true }),

  pularFechamento: async () => {
    set({ fechandoComBackup: false })
    await window.psitrack.backup.pularFechamento()
  },

  verificarAtualizacao: async () => {
    set({ atualizacaoStatus: 'verificando', atualizacaoError: null })
    const result = await window.psitrack.app.verificarAtualizacao()
    if (!result.ok) {
      set({ atualizacaoStatus: 'erro', atualizacaoError: result.error })
      return
    }
    set({
      atualizacaoStatus: result.atualizacaoDisponivel ? 'disponivel' : 'ocioso',
      atualizacaoVersaoDisponivel: result.versaoDisponivel
    })
  },

  // Dispara e não espera: faz backup, baixa e chama quitAndInstall() no
  // main — o app fecha e reabre sozinho já na versão nova, mesmo padrão de
  // `restaurar` (a promise normalmente nunca chega a resolver aqui).
  baixarEInstalarAtualizacao: async () => {
    set({ atualizacaoStatus: 'baixando', atualizacaoProgresso: 0, atualizacaoError: null })
    const result = await window.psitrack.app.baixarEInstalarAtualizacao()
    if (!result.ok) {
      set({ atualizacaoStatus: 'erro', atualizacaoError: result.error })
    }
  },

  registrarProgressoAtualizacao: (percentual) => set({ atualizacaoProgresso: percentual })
}))
