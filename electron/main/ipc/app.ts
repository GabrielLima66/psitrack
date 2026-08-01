import { app, ipcMain } from 'electron'

/**
 * Handlers do domínio "app": informação não sensível sobre o processo main.
 * Serve também para provar, já na Etapa 1, que o caminho preload → IPC →
 * main está de fato ativo antes de qualquer lógica de cripto/banco existir.
 */
export function registerAppHandlers(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())
}
