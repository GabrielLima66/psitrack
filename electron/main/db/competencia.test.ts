import { afterEach, describe, expect, it } from 'vitest'
import { calcularCompetencia } from './competencia'

describe('calcularCompetencia', () => {
  const tzOriginal = process.env.TZ

  afterEach(() => {
    process.env.TZ = tzOriginal
  })

  it('sessão local de 31/01 23:00 gera competência 2025-01, não 2025-02', () => {
    // 31/01/2025 23:00 em America/Sao_Paulo (UTC-3) = 01/02/2025 02:00 UTC.
    expect(calcularCompetencia('2025-02-01T02:00:00.000Z')).toBe('2025-01')
  })

  it('sessão bem no meio do mês não muda de competência', () => {
    expect(calcularCompetencia('2026-06-15T18:00:00.000Z')).toBe('2026-06')
  })

  it('independe do TZ do sistema', () => {
    for (const tz of ['America/Sao_Paulo', 'UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
      process.env.TZ = tz
      expect(calcularCompetencia('2025-02-01T02:00:00.000Z')).toBe('2025-01')
    }
  })
})
