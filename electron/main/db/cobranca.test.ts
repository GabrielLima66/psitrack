import { describe, expect, it } from 'vitest'
import { decidirCobranca, type ContratoParaCobranca, type PoliticaFalta, type StatusSessaoCobravel } from './cobranca'

const VALOR = 15000 // R$150,00 por sessão

function contrato(politicaFalta: PoliticaFalta, avisoMinimoHoras = 24): ContratoParaCobranca {
  return { valorCentavos: VALOR, politicaFalta, avisoMinimoHoras }
}

const POLITICAS: PoliticaFalta[] = ['cobra_sempre', 'cobra_sem_aviso', 'nunca_cobra']

// Aviso dado 30h antes da sessão — "aviso confortável", usado como fixture
// neutro nas 6x3 linhas da tabela (as nuances de tempo têm testes próprios
// logo abaixo).
const INICIO_UTC = '2026-03-10T15:00:00.000Z'
const AVISO_CONFORTAVEL = '2026-03-09T09:00:00.000Z' // 30h antes

describe('decidirCobranca — 6 status × 3 políticas', () => {
  const NUNCA_COBRA_INDEPENDENTE_DE_POLITICA: StatusSessaoCobravel[] = ['agendada', 'remarcada', 'cancelada_profissional']

  it.each(NUNCA_COBRA_INDEPENDENTE_DE_POLITICA.flatMap((status) => POLITICAS.map((politica) => [status, politica] as const)))(
    '%s nunca cobra, política %s',
    (status, politica) => {
      const resultado = decidirCobranca({ status, inicioUtc: INICIO_UTC, avisadaEm: null }, contrato(politica))
      expect(resultado).toEqual({ cobra: false })
    }
  )

  it.each(POLITICAS)('realizada sempre cobra tipo sessao, política %s', (politica) => {
    const resultado = decidirCobranca({ status: 'realizada', inicioUtc: INICIO_UTC, avisadaEm: null }, contrato(politica))
    expect(resultado).toEqual({ cobra: true, tipo: 'sessao', valorCentavos: VALOR })
  })

  it.each(POLITICAS)('falta_sem_aviso cobra salvo política nunca_cobra (política %s)', (politica) => {
    const resultado = decidirCobranca({ status: 'falta_sem_aviso', inicioUtc: INICIO_UTC, avisadaEm: null }, contrato(politica))
    if (politica === 'nunca_cobra') {
      expect(resultado).toEqual({ cobra: false })
    } else {
      expect(resultado).toEqual({ cobra: true, tipo: 'falta', valorCentavos: VALOR })
    }
  })

  it.each(POLITICAS)('falta_com_aviso com aviso confortável (30h), política %s', (politica) => {
    const resultado = decidirCobranca(
      { status: 'falta_com_aviso', inicioUtc: INICIO_UTC, avisadaEm: AVISO_CONFORTAVEL },
      contrato(politica, 24)
    )
    if (politica === 'cobra_sempre') {
      expect(resultado).toEqual({ cobra: true, tipo: 'falta', valorCentavos: VALOR })
    } else if (politica === 'nunca_cobra') {
      expect(resultado).toEqual({ cobra: false })
    } else {
      // cobra_sem_aviso: 30h de antecedência >= 24h mínimas → aviso suficiente, não cobra
      expect(resultado).toEqual({ cobra: false })
    }
  })
})

describe('decidirCobranca — falta_com_aviso / cobra_sem_aviso, o limiar de horas', () => {
  it('30h de antecedência com mínimo de 24h → sem cobrança', () => {
    const resultado = decidirCobranca(
      { status: 'falta_com_aviso', inicioUtc: INICIO_UTC, avisadaEm: AVISO_CONFORTAVEL },
      contrato('cobra_sem_aviso', 24)
    )
    expect(resultado).toEqual({ cobra: false })
  })

  it('12h de antecedência com mínimo de 24h → cobra', () => {
    const avisoEmCimaDaHora = '2026-03-10T03:00:00.000Z' // 12h antes de INICIO_UTC
    const resultado = decidirCobranca(
      { status: 'falta_com_aviso', inicioUtc: INICIO_UTC, avisadaEm: avisoEmCimaDaHora },
      contrato('cobra_sem_aviso', 24)
    )
    expect(resultado).toEqual({ cobra: true, tipo: 'falta', valorCentavos: VALOR })
  })

  it('exatamente no limiar (24h) conta como suficiente (não cobra)', () => {
    const avisoNoLimiar = '2026-03-09T15:00:00.000Z' // exatamente 24h antes
    const resultado = decidirCobranca(
      { status: 'falta_com_aviso', inicioUtc: INICIO_UTC, avisadaEm: avisoNoLimiar },
      contrato('cobra_sem_aviso', 24)
    )
    expect(resultado).toEqual({ cobra: false })
  })

  it('sem avisadaEm registrado (dado inconsistente) trata como aviso insuficiente — cobra', () => {
    const resultado = decidirCobranca(
      { status: 'falta_com_aviso', inicioUtc: INICIO_UTC, avisadaEm: null },
      contrato('cobra_sem_aviso', 24)
    )
    expect(resultado).toEqual({ cobra: true, tipo: 'falta', valorCentavos: VALOR })
  })
})
