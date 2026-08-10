/**
 * "Pular" no overlay de fechamento (Etapa 21): estado da janela de ~1s entre
 * `before-quit` avisar a UI e o backup automático de fechar de fato começar
 * a rodar. Não é estado de backup — é o app decidindo se ainda dá tempo de
 * reagir ao clique antes de travar a thread com I/O síncrono.
 * `solicitarPularFechamento` é chamado da UI (via `ipc/backup.ts`);
 * `foiPularFechamentoSolicitado`/`resetarPularFechamento` são consultados
 * pelo fluxo de `before-quit` em `index.ts`.
 */
let pularFechamentoSolicitado = false

export function solicitarPularFechamento(): void {
  pularFechamentoSolicitado = true
}

export function foiPularFechamentoSolicitado(): boolean {
  return pularFechamentoSolicitado
}

export function resetarPularFechamento(): void {
  pularFechamentoSolicitado = false
}

/**
 * Setado por `update.ts` depois de já ter feito o próprio backup de
 * segurança, logo antes de chamar `autoUpdater.quitAndInstall()` — sinaliza
 * pro `before-quit` de `index.ts` pular o fluxo normal de "backup antes de
 * fechar" (redundante aqui, backup já rodou) e deixar o `app.quit()` seguir
 * sem interceptar. Sem isso, `event.preventDefault()` no before-quit trava
 * o próprio ciclo de vida que o `quitAndInstall()` precisa (`will-quit`) pra
 * instalar e reabrir de verdade.
 */
let saidaParaAtualizacaoPermitida = false

export function permitirSaidaParaAtualizacao(): void {
  saidaParaAtualizacaoPermitida = true
}

export function saidaParaAtualizacaoFoiPermitida(): boolean {
  return saidaParaAtualizacaoPermitida
}
