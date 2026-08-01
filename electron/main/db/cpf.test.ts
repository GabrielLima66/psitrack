import { describe, expect, it } from 'vitest'
import { isValidCpf } from './cpf'

describe('isValidCpf', () => {
  it('aceita CPF válido conhecido', () => {
    expect(isValidCpf('11144477735')).toBe(true)
  })

  it('rejeita dígito verificador errado', () => {
    expect(isValidCpf('11144477736')).toBe(false)
  })

  it('rejeita sequência de dígitos repetidos', () => {
    expect(isValidCpf('11111111111')).toBe(false)
    expect(isValidCpf('00000000000')).toBe(false)
  })

  it('rejeita algo que não seja 11 dígitos', () => {
    expect(isValidCpf('123')).toBe(false)
    expect(isValidCpf('111.444.777-35')).toBe(false)
  })
})
