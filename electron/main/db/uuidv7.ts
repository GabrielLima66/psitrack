import { randomBytes } from 'node:crypto'

/**
 * UUID v7 (RFC 9562) implementado à mão — não justifica dependência nova pra
 * um algoritmo simples e bem especificado (regra do CLAUDE.md). 48 bits de
 * timestamp em ms + 74 bits aleatórios, com os nibbles de versão (7) e
 * variante (10) sobrescritos nos lugares certos. Ordena lexicograficamente
 * pela mesma ordem de geração, ao contrário de um UUID v4 aleatório.
 */
export function uuidv7(): string {
  const unixTsMs = BigInt(Date.now())
  const bytes = randomBytes(16)

  bytes[0] = Number((unixTsMs >> 40n) & 0xffn)
  bytes[1] = Number((unixTsMs >> 32n) & 0xffn)
  bytes[2] = Number((unixTsMs >> 24n) & 0xffn)
  bytes[3] = Number((unixTsMs >> 16n) & 0xffn)
  bytes[4] = Number((unixTsMs >> 8n) & 0xffn)
  bytes[5] = Number(unixTsMs & 0xffn)

  bytes[6] = (bytes[6] & 0x0f) | 0x70 // versão 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variante RFC 9562 (10xxxxxx)

  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}
