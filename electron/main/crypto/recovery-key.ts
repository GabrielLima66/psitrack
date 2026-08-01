import { randomBytes } from 'node:crypto'

const RECOVERY_KEY_LENGTH_BYTES = 32 // 256 bits — usado direto como chave AES-256-GCM

// Alfabeto Crockford: exclui I, L, O, U de propósito (evita confusão com
// 1, 1, 0 e leitura errada em voz alta). Decode abaixo é tolerante a essas
// trocas mesmo assim, para o caso da usuária transcrever errado.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Gera o segredo da recovery key: 32 bytes aleatórios, entropia máxima. */
export function generateRecoveryKey(): Buffer {
  return randomBytes(RECOVERY_KEY_LENGTH_BYTES)
}

/** Codifica bytes em texto Crockford base32 (sem separadores). */
export function encodeRecoveryKey(bytes: Buffer): string {
  let value = 0
  let bits = 0
  let output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 0x1f]
  }
  return output
}

/** Decodifica de volta pra bytes. Tolera minúsculas, hífens/espaços e I/L/O ambíguos. */
export function decodeRecoveryKey(text: string): Buffer {
  const cleaned = text
    .toUpperCase()
    .replace(/[-\s]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')

  let value = 0
  let bits = 0
  const bytes: number[] = []
  for (const char of cleaned) {
    const index = ALPHABET.indexOf(char)
    if (index === -1) {
      throw new Error('Recovery key inválida: caractere fora do alfabeto Crockford base32.')
    }
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

/** Formata pra exibição em blocos legíveis: `ABCDE-FGHJK-...`. */
export function formatRecoveryKeyForDisplay(encoded: string, groupSize = 5): string {
  const groups: string[] = []
  for (let i = 0; i < encoded.length; i += groupSize) {
    groups.push(encoded.slice(i, i + groupSize))
  }
  return groups.join('-')
}
