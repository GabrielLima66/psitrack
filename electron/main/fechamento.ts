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
