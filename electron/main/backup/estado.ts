/**
 * Flag em memória, só pra fechar a corrida entre "acabei de decidir agendar
 * um backup automático" e "o auto-lock zera a DEK antes dele rodar de
 * verdade" (Etapa 21) — não é sobre interromper um backup já em execução
 * (I/O síncrono: uma vez começado, ninguém mais roda até ele terminar).
 */
let emAndamento = false

export function backupAutomaticoEmAndamento(): boolean {
  return emAndamento
}

export function marcarBackupAutomaticoIniciado(): void {
  emAndamento = true
}

export function marcarBackupAutomaticoConcluido(): void {
  emAndamento = false
}

/**
 * `total_changes()` do SQLite conta desde que a CONEXÃO abriu — o que inclui
 * a migração automática e a materialização de recorrências que rodam em
 * todo unlock (`openAndMigrate`), não só o que a usuária de fato editou.
 * Por isso a baseline é capturada uma vez, logo depois desses passos
 * automáticos terminarem — `houveEscritaNaSessao` compara contra ela, não
 * contra zero, senão ia dar "houve escrita" quase sempre, mesmo sem a
 * usuária ter tocado em nada.
 */
let baselineTotalChanges = 0

export function definirBaselineEscritas(valor: number): void {
  baselineTotalChanges = valor
}

export function obterBaselineEscritas(): number {
  return baselineTotalChanges
}

/**
 * "Pular" no overlay de fechamento (Etapa 21) — só tem efeito se chegar
 * ANTES do backup começar a rodar: I/O daqui é síncrono, então uma vez que
 * `dispararBackupAutomaticoSeNecessario` começou a executar, a thread do
 * main está ocupada e nem processa esta chamada até terminar.
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
