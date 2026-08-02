import { describe, expect, it } from 'vitest'
import { diaSemanaLocal, inicioDaSemana, localParaUtc, somarDias, utcParaDataLocal } from './tempo'

describe('localParaUtc', () => {
  it('14:00 em São Paulo vira 17:00Z', () => {
    expect(localParaUtc('2026-03-10', '14:00')).toBe('2026-03-10T17:00:00.000Z')
  })
})

describe('utcParaDataLocal', () => {
  it('é a inversa de localParaUtc', () => {
    expect(utcParaDataLocal('2026-03-10T17:00:00.000Z')).toBe('2026-03-10')
  })
})

describe('diaSemanaLocal', () => {
  it('2026-03-10 é uma terça (2)', () => {
    expect(diaSemanaLocal('2026-03-10')).toBe(2)
  })
})

describe('somarDias', () => {
  it('vira o mês corretamente', () => {
    expect(somarDias('2026-01-31', 1)).toBe('2026-02-01')
  })
})

describe('inicioDaSemana', () => {
  it('terça volta pro domingo da mesma semana', () => {
    expect(inicioDaSemana('2026-03-10')).toBe('2026-03-08')
  })

  it('domingo é o início da própria semana', () => {
    expect(inicioDaSemana('2026-03-08')).toBe('2026-03-08')
  })
})
