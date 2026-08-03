import { create } from 'zustand'

export type AreaApp = 'pacientes' | 'agenda' | 'receber' | 'configuracoes'

interface NavigationState {
  area: AreaApp
  irPara: (area: AreaApp) => void
}

/** Navegação de topo — só troca qual feature ocupa a tela inteira, sem router (mesma filosofia state-driven do resto do app). */
export const useNavigationStore = create<NavigationState>((set) => ({
  area: 'pacientes',
  irPara: (area) => set({ area })
}))
