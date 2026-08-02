import { afterEach, describe, expect, it } from 'vitest'
import { localParaUtc, utcParaDataLocal } from './timezone'

describe('localParaUtc', () => {
  const TZ_ORIGINAL = process.env.TZ

  afterEach(() => {
    process.env.TZ = TZ_ORIGINAL
  })

  it('14:00 em São Paulo vira 17:00Z (UTC-3)', () => {
    expect(localParaUtc('2026-03-10', '14:00')).toBe('2026-03-10T17:00:00.000Z')
  })

  it('vira o dia: 23:00 local de 31/01 é 02:00Z de 01/02', () => {
    expect(localParaUtc('2026-01-31', '23:00')).toBe('2026-02-01T02:00:00.000Z')
  })

  it('meia-noite local', () => {
    expect(localParaUtc('2026-06-15', '00:00')).toBe('2026-06-15T03:00:00.000Z')
  })

  it('independe do TZ do processo rodando o app', () => {
    process.env.TZ = 'America/New_York'
    expect(localParaUtc('2026-03-10', '14:00')).toBe('2026-03-10T17:00:00.000Z')
    process.env.TZ = 'UTC'
    expect(localParaUtc('2026-03-10', '14:00')).toBe('2026-03-10T17:00:00.000Z')
  })
})

describe('utcParaDataLocal', () => {
  it('é a inversa de localParaUtc pro mesmo dia', () => {
    expect(utcParaDataLocal('2026-03-10T17:00:00.000Z')).toBe('2026-03-10')
  })

  it('02:00Z ainda é 31/01 local (23h do dia anterior)', () => {
    expect(utcParaDataLocal('2026-02-01T02:00:00.000Z')).toBe('2026-01-31')
  })
})
