import { describe, expect, it } from 'vitest'
import { normalizarTelefoneBr } from './normalizarTelefone'

describe('normalizarTelefoneBr', () => {
  it('celular sem DDI (11 dígitos) prefixa 55', () => {
    expect(normalizarTelefoneBr('11987654321')).toBe('5511987654321')
  })

  it('fixo sem DDI (10 dígitos) prefixa 55', () => {
    expect(normalizarTelefoneBr('1133334444')).toBe('551133334444')
  })

  it('celular já com DDI 55 (13 dígitos) mantém como está', () => {
    expect(normalizarTelefoneBr('5511987654321')).toBe('5511987654321')
  })

  it('fixo já com DDI 55 (12 dígitos) mantém como está', () => {
    expect(normalizarTelefoneBr('551133334444')).toBe('551133334444')
  })

  it('aceita formatação com +, espaços, parênteses e traços', () => {
    expect(normalizarTelefoneBr('+55 (11) 98765-4321')).toBe('5511987654321')
  })

  it('0800 é rejeitado', () => {
    expect(normalizarTelefoneBr('0800 123 4567')).toBeNull()
  })

  it('0300 é rejeitado', () => {
    expect(normalizarTelefoneBr('0300 123 4567')).toBeNull()
  })

  it('12/13 dígitos sem prefixo 55 é rejeitado (DDI estranho ou dois números concatenados)', () => {
    expect(normalizarTelefoneBr('121198765432')).toBeNull()
    expect(normalizarTelefoneBr('1211987654321')).toBeNull()
  })

  it('8 ou 9 dígitos sem DDD é rejeitado', () => {
    expect(normalizarTelefoneBr('98765432')).toBeNull()
    expect(normalizarTelefoneBr('987654321')).toBeNull()
  })

  it('curto ou longo demais é rejeitado', () => {
    expect(normalizarTelefoneBr('123')).toBeNull()
    expect(normalizarTelefoneBr('123456789012345')).toBeNull()
  })

  it('null, vazio ou só espaço é rejeitado', () => {
    expect(normalizarTelefoneBr(null)).toBeNull()
    expect(normalizarTelefoneBr('')).toBeNull()
    expect(normalizarTelefoneBr('   ')).toBeNull()
  })
})
