import { app, ipcMain, shell } from 'electron'

/**
 * URL fixa no main — o renderer nunca escolhe o destino. Verificação é
 * 100% manual (usuário clica) e sai pelo navegador do sistema via
 * shell.openExternal; o processo do app não faz nenhuma requisição de
 * rede (CLAUDE.md invariante de segurança #7 — "sem rede").
 */
const URL_RELEASES = 'https://github.com/GabrielLima66/psitrack/releases'

/**
 * Handlers do domínio "app": informação não sensível sobre o processo main.
 * Serve também para provar, já na Etapa 1, que o caminho preload → IPC →
 * main está de fato ativo antes de qualquer lógica de cripto/banco existir.
 */
export function registerAppHandlers(): void {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('app:verificarAtualizacoes', () => shell.openExternal(URL_RELEASES))
}
