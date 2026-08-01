/**
 * Único lugar do processo main que segura a DEK em memória depois do
 * desbloqueio (CLAUDE.md invariante #1: a DEK nunca trafega por IPC nem sai
 * do main). `lock()` zera o Buffer — não dá pra zerar de verdade heap de
 * string do V8, por isso a DEK sempre vive como Buffer aqui, nunca como
 * string, do desbloqueio até o lock.
 */
export class KeySession {
  #dek: Buffer | null = null

  unlock(dek: Buffer): void {
    this.#dek = dek
  }

  get isUnlocked(): boolean {
    return this.#dek !== null
  }

  getDek(): Buffer {
    if (!this.#dek) {
      throw new Error('Sessão travada: não há DEK em memória.')
    }
    return this.#dek
  }

  lock(): void {
    this.#dek?.fill(0)
    this.#dek = null
  }
}
