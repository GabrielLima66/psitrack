import { describe, expect, it } from 'vitest'
import { deriveKek, DEFAULT_ARGON2_PARAMS } from './argon2'

describe('argon2', () => {
  it('deriva sempre 32 bytes (256 bits, tamanho da KEK)', async () => {
    const kek = await deriveKek('senha-teste', Buffer.alloc(16, 1))
    expect(kek).toHaveLength(32)
  })

  it('é determinístico: mesma senha + mesmo salt + mesmos parâmetros = mesma KEK', async () => {
    const salt = Buffer.alloc(16, 7)
    const a = await deriveKek('senha-teste', salt, DEFAULT_ARGON2_PARAMS)
    const b = await deriveKek('senha-teste', salt, DEFAULT_ARGON2_PARAMS)
    expect(a.equals(b)).toBe(true)
  })

  it('salt diferente produz KEK diferente pra mesma senha', async () => {
    const a = await deriveKek('senha-teste', Buffer.alloc(16, 1))
    const b = await deriveKek('senha-teste', Buffer.alloc(16, 2))
    expect(a.equals(b)).toBe(false)
  })

  it('senha diferente produz KEK diferente pro mesmo salt', async () => {
    const salt = Buffer.alloc(16, 3)
    const a = await deriveKek('senha-a', salt)
    const b = await deriveKek('senha-b', salt)
    expect(a.equals(b)).toBe(false)
  })
})
