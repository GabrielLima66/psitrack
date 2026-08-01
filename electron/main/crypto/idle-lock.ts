// CLAUDE.md invariante #6: 5 min de ociosidade de teclado/mouse do SO.
export const AUTO_LOCK_THRESHOLD_SECONDS = 5 * 60

export interface AutoLockOptions {
  /** Injeção de dependência: quem chama passa `powerMonitor.getSystemIdleTime`
   *  (ociosidade do SO inteiro, não listener de mouse/teclado no renderer —
   *  isso deixa este módulo puro/testável e mantém o zeramento da DEK
   *  inteiramente dentro do main). */
  getIdleSeconds: () => number
  onLock: () => void
  thresholdSeconds?: number
  pollIntervalMs?: number
}

export interface AutoLockHandle {
  stop: () => void
}

/**
 * Poll periódico, não listener de evento: `onLock` é chamado a cada tick em
 * que a ociosidade já passou do limiar. Isso é intencional — `onLock` deve
 * ser idempotente (ver `KeySession.lock`), e um poll simples evita ter que
 * modelar estado "já travei essa ociosidade ou não" aqui.
 */
export function startAutoLock(options: AutoLockOptions): AutoLockHandle {
  const thresholdSeconds = options.thresholdSeconds ?? AUTO_LOCK_THRESHOLD_SECONDS
  const pollIntervalMs = options.pollIntervalMs ?? 5000

  const interval = setInterval(() => {
    if (options.getIdleSeconds() >= thresholdSeconds) {
      options.onLock()
    }
  }, pollIntervalMs)

  return {
    stop: () => clearInterval(interval)
  }
}
