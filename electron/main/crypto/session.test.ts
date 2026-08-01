import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { KeySession } from './session'

describe('KeySession', () => {
  it('começa travada', () => {
    expect(new KeySession().isUnlocked).toBe(false)
  })

  it('getDek lança erro enquanto travada', () => {
    expect(() => new KeySession().getDek()).toThrow()
  })

  it('unlock guarda a DEK e getDek retorna o mesmo buffer', () => {
    const session = new KeySession()
    const dek = randomBytes(32)
    session.unlock(dek)
    expect(session.isUnlocked).toBe(true)
    expect(session.getDek().equals(dek)).toBe(true)
  })

  it('lock zera os bytes da DEK e trava a sessão', () => {
    const session = new KeySession()
    const dek = randomBytes(32)
    session.unlock(dek)
    session.lock()
    expect(session.isUnlocked).toBe(false)
    expect(dek.equals(Buffer.alloc(32, 0))).toBe(true)
    expect(() => session.getDek()).toThrow()
  })

  it('lock sem unlock prévio não lança erro (idempotente)', () => {
    expect(() => new KeySession().lock()).not.toThrow()
  })
})
