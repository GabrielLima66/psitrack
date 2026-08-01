import { contextBridge, ipcRenderer } from 'electron'

/**
 * Superfície exposta ao renderer. Só DTOs simples cruzam essa fronteira —
 * nunca a DEK, nunca um handle de banco, nunca um Buffer de chave.
 * (invariante de segurança #1 e #2 do CLAUDE.md)
 */

// `throw` num handler de ipcMain vira uma mensagem de erro suja no renderer
// ("Error invoking remote method..."), então os handlers de vault nunca
// rejeitam — devolvem `{ ok, ... }` como valor normal.
type VaultResult<T extends object = Record<string, never>> = ({ ok: true } & T) | { ok: false; error: string }

const api = {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
  },
  vault: {
    status: (): Promise<{ exists: boolean }> => ipcRenderer.invoke('vault:status'),
    create: (password: string): Promise<VaultResult<{ recoveryKey: string }>> =>
      ipcRenderer.invoke('vault:create', password),
    unlock: (password: string): Promise<VaultResult> => ipcRenderer.invoke('vault:unlock', password),
    unlockWithRecovery: (recoveryKey: string): Promise<VaultResult> =>
      ipcRenderer.invoke('vault:unlockWithRecovery', recoveryKey),
    completeRecoverySetup: (newPassword: string): Promise<VaultResult<{ recoveryKey: string }>> =>
      ipcRenderer.invoke('vault:completeRecoverySetup', newPassword),
    lock: (): Promise<void> => ipcRenderer.invoke('vault:lock'),
    /** Disparado pelo main quando o auto-lock por inatividade trava a sessão. Devolve a função de cancelar a inscrição. */
    onLocked: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      ipcRenderer.on('vault:locked', listener)
      return () => ipcRenderer.removeListener('vault:locked', listener)
    }
  }
}

export type PsiTrackApi = typeof api

contextBridge.exposeInMainWorld('psitrack', api)
