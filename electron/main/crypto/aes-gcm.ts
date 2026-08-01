import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const NONCE_LENGTH_BYTES = 12

/** Resultado de uma cifragem: os três componentes que o GCM produz. */
export interface SealedBox {
  nonce: Buffer
  authTag: Buffer
  ciphertext: Buffer
}

/** Cifra `plaintext` com `key` (32 bytes). Nonce novo e aleatório a cada chamada. */
export function seal(key: Buffer, plaintext: Buffer): SealedBox {
  const nonce = randomBytes(NONCE_LENGTH_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const authTag = cipher.getAuthTag()
  return { nonce, authTag, ciphertext }
}

/**
 * Decifra uma SealedBox. Lança erro se `key` estiver errada ou se qualquer
 * componente tiver sido alterado — é o GCM authentication tag fazendo seu
 * trabalho, não uma checagem manual.
 */
export function open(key: Buffer, box: SealedBox): Buffer {
  const decipher = createDecipheriv(ALGORITHM, key, box.nonce)
  decipher.setAuthTag(box.authTag)
  return Buffer.concat([decipher.update(box.ciphertext), decipher.final()])
}
