import { create } from 'zustand'
import type { BackupListado, BackupVerificationResult, RegistroRestauracao } from './types'

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

  carregar: () => Promise<void>
  criarBackup: () => Promise<void>
  verificar: (pasta: string) => Promise<void>
  restaurar: (pasta: string) => void
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

  carregar: async () => {
    set({ loading: true, error: null })
    const [backups, ultimaRestauracao, versao] = await Promise.all([
      window.psitrack.backup.listar(),
      window.psitrack.backup.ultimaRestauracao(),
      window.psitrack.app.getVersion()
    ])
    set({
      loading: false,
      backups: backups.ok ? backups.backups : [],
      ultimaRestauracao: ultimaRestauracao.ok ? ultimaRestauracao.registro : null,
      versao,
      error: !backups.ok ? backups.error : null
    })
  },

  criarBackup: async () => {
    set({ criando: true, error: null })
    const result = await window.psitrack.backup.criar()
    set({ criando: false })
    if (!result.ok) {
      set({ error: result.error })
      return
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
  }
}))
