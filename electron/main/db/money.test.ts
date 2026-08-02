import { describe, expect, it } from 'vitest'
import { centavosSchema, isCentavosValido } from './money'

describe('isCentavosValido', () => {
  it('aceita inteiros positivos, negativos (desconto) e zero', () => {
    expect(isCentavosValido(15000)).toBe(true)
    expect(isCentavosValido(-500)).toBe(true)
    expect(isCentavosValido(0)).toBe(true)
  })

  it('rejeita float', () => {
    expect(isCentavosValido(150.5)).toBe(false)
  })

  it('rejeita NaN e Infinity', () => {
    expect(isCentavosValido(NaN)).toBe(false)
    expect(isCentavosValido(Infinity)).toBe(false)
    expect(isCentavosValido(-Infinity)).toBe(false)
  })
})

describe('centavosSchema', () => {
  it('parse falha pra float', () => {
    expect(() => centavosSchema.parse(99.9)).toThrow()
  })

  it('parse passa pra inteiro', () => {
    expect(centavosSchema.parse(15000)).toBe(15000)
  })
})
