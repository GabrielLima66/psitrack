import { afterEach, describe, expect, it } from 'vitest'
import { formatarDataBr, formatarDataHoraBr } from './formatters'

describe('formatarDataBr', () => {
  it('não faz matemática de data — só rearranja a string', () => {
    expect(formatarDataBr('2026-01-05')).toBe('05/01/2026')
  })
})

describe('formatarDataHoraBr', () => {
  const tzOriginal = process.env.TZ

  afterEach(() => {
    process.env.TZ = tzOriginal
  })

  // 02:00 UTC de 15/jan é 23:00 de 14/jan em São Paulo (UTC-3, sem horário
  // de verão desde 2019) — cruza o dia de propósito, pra provar que é
  // conversão de fuso de verdade, não só corte de string.
  const ISO_UTC = '2026-01-15T02:00:00.000Z'
  const ESPERADO_SP = '14/01/2026, 23:00'

  it('converte UTC para America/Sao_Paulo independente do TZ do sistema', () => {
    for (const tz of ['America/Sao_Paulo', 'UTC', 'Asia/Tokyo', 'America/Los_Angeles']) {
      process.env.TZ = tz
      expect(formatarDataHoraBr(ISO_UTC)).toBe(ESPERADO_SP)
    }
  })
})
