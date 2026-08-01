import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { seal, open } from './aes-gcm'

describe('aes-gcm', () => {
  it('round-trip: open(seal(x)) === x', () => {
    const key = randomBytes(32)
    const plaintext = Buffer.from('dado sensível de teste')
    const box = seal(key, plaintext)
    expect(open(key, box).equals(plaintext)).toBe(true)
  })

  it('rejeita a chave errada', () => {
    const box = seal(randomBytes(32), Buffer.from('segredo'))
    expect(() => open(randomBytes(32), box)).toThrow()
  })

  it('rejeita ciphertext adulterado (auth tag do GCM pega)', () => {
    const key = randomBytes(32)
    const box = seal(key, Buffer.from('segredo'))
    box.ciphertext[0] ^= 0xff
    expect(() => open(key, box)).toThrow()
  })

  it('rejeita auth tag adulterado', () => {
    const key = randomBytes(32)
    const box = seal(key, Buffer.from('segredo'))
    box.authTag[0] ^= 0xff
    expect(() => open(key, box)).toThrow()
  })

  it('nonce é diferente a cada chamada de seal', () => {
    const key = randomBytes(32)
    const a = seal(key, Buffer.from('x'))
    const b = seal(key, Buffer.from('x'))
    expect(a.nonce.equals(b.nonce)).toBe(false)
  })
})
