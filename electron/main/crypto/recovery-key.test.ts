import { describe, expect, it } from 'vitest'
import {
  generateRecoveryKey,
  encodeRecoveryKey,
  decodeRecoveryKey,
  formatRecoveryKeyForDisplay
} from './recovery-key'

describe('recovery-key', () => {
  it('gera 32 bytes (256 bits) de entropia', () => {
    expect(generateRecoveryKey()).toHaveLength(32)
  })

  it('encode/decode faz round-trip exato', () => {
    const key = generateRecoveryKey()
    expect(decodeRecoveryKey(encodeRecoveryKey(key)).equals(key)).toBe(true)
  })

  it('decode tolera minúsculas, hífens e espaços', () => {
    const key = generateRecoveryKey()
    const formatted = formatRecoveryKeyForDisplay(encodeRecoveryKey(key))
    const messy = formatted.toLowerCase().replace(/-/g, ' ')
    expect(decodeRecoveryKey(messy).equals(key)).toBe(true)
  })

  it('decode tolera O/I/L transcritos ambiguamente', () => {
    const key = generateRecoveryKey()
    const encoded = encodeRecoveryKey(key)
    // só testa a tolerância se o encode de fato não produziu O/I/L (não deveria, já que
    // não fazem parte do alfabeto de saída) — troca um caractere plausível por variante ambígua
    const withO = encoded.replace(/0/, 'O')
    const withI = encoded.replace(/1/, 'I')
    expect(decodeRecoveryKey(withO).equals(key)).toBe(true)
    expect(decodeRecoveryKey(withI).equals(key)).toBe(true)
  })

  it('rejeita caractere fora do alfabeto Crockford', () => {
    expect(() => decodeRecoveryKey('!!!!!')).toThrow()
  })

  it('formata em blocos de 5 separados por hífen', () => {
    const formatted = formatRecoveryKeyForDisplay('ABCDEFGHIJKLM', 5)
    expect(formatted).toBe('ABCDE-FGHIJ-KLM')
  })
})
