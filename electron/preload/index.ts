import { contextBridge, ipcRenderer } from 'electron'

/**
 * Superfície exposta ao renderer. Só DTOs simples cruzam essa fronteira —
 * nunca a DEK, nunca um handle de banco, nunca um Buffer de chave.
 * (invariante de segurança #1 e #2 do CLAUDE.md)
 */
const api = {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
  }
}

export type PsiTrackApi = typeof api

contextBridge.exposeInMainWorld('psitrack', api)
