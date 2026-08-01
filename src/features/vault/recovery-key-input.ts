const BLOCK_SIZE = 5

// A recovery key é 32 bytes (256 bits, electron/main/crypto/recovery-key.ts)
// codificados em Crockford base32: ceil(256 / 5) = 52 caracteres. Isso NÃO
// dá um número redondo de blocos de 5 (52 = 10×5 + 2) — o último bloco fica
// com só 2 caracteres. É o preço de manter os 256 bits de verdade (a
// recovery key é usada direto como chave AES-256-GCM, sem KDF, porque já é
// entropia máxima) em vez de encolher a chave só pra caber num layout de
// blocos uniformes.
const TOTAL_CHARS = 52

/**
 * Máscara de exibição só — não valida o alfabeto Crockford (o main faz isso
 * de verdade ao decodificar). Normaliza maiúsculas, remove tudo que não for
 * alfanumérico (inclusive hífens já digitados) e reagrupa em blocos de 5.
 * Funciona colando a chave inteira, com ou sem hífens.
 */
export function formatRecoveryKeyInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, TOTAL_CHARS)

  const groups: string[] = []
  for (let i = 0; i < cleaned.length; i += BLOCK_SIZE) {
    groups.push(cleaned.slice(i, i + BLOCK_SIZE))
  }
  return groups.join('-')
}

export function countEnteredChars(formatted: string): number {
  return formatted.replace(/-/g, '').length
}

export const RECOVERY_KEY_TOTAL_CHARS = TOTAL_CHARS
