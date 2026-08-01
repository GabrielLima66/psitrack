import { describe, expect, it } from 'vitest'
import { uuidv7 } from './uuidv7'

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuidv7', () => {
  it('gera no formato UUID v7 (versão 7, variante RFC 9562)', () => {
    expect(uuidv7()).toMatch(UUID_V7_REGEX)
  })

  it('nunca colide em 10 mil gerações', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => uuidv7()))
    expect(ids.size).toBe(10_000)
  })

  it('ordena lexicograficamente na ordem de geração (timestamp nos bits mais significativos)', async () => {
    const a = uuidv7()
    await new Promise((resolve) => setTimeout(resolve, 5))
    const b = uuidv7()
    expect(a < b).toBe(true)
  })
})
