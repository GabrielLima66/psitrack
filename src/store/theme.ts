import { create } from 'zustand'

export type Aparencia = 'light' | 'dark' | 'system'

const CHAVE_STORAGE = 'psitrack:aparencia'

function prefereEscuroDoSistema(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Liga/desliga a classe `.dark` no <html> — só isso, sem tocar em config.json/IPC (100% renderer-local, invariante de rede intocado). */
function aplicarNoDocumento(aparencia: Aparencia): void {
  const escuro = aparencia === 'dark' || (aparencia === 'system' && prefereEscuroDoSistema())
  document.documentElement.classList.toggle('dark', escuro)
}

function lerPreferenciaSalva(): Aparencia {
  const salvo = localStorage.getItem(CHAVE_STORAGE)
  return salvo === 'light' || salvo === 'dark' || salvo === 'system' ? salvo : 'system'
}

interface ThemeStoreState {
  aparencia: Aparencia
  definirAparencia: (aparencia: Aparencia) => void
}

/**
 * Store de tema (Etapa 8 do redesign) — aplicado uma vez ao importar este
 * módulo (App.tsx importa por efeito colateral, antes do primeiro render),
 * pra não piscar claro antes de aplicar a preferência salva.
 */
export const useThemeStore = create<ThemeStoreState>((set) => {
  const inicial = lerPreferenciaSalva()
  aplicarNoDocumento(inicial)

  return {
    aparencia: inicial,
    definirAparencia: (aparencia) => {
      localStorage.setItem(CHAVE_STORAGE, aparencia)
      aplicarNoDocumento(aparencia)
      set({ aparencia })
    }
  }
})

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useThemeStore.getState().aparencia === 'system') aplicarNoDocumento('system')
})
