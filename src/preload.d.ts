import type { PsiTrackApi } from '../electron/preload'

declare global {
  interface Window {
    psitrack: PsiTrackApi
  }
}

export {}
