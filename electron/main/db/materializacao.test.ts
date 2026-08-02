import { describe, expect, it } from 'vitest'
import { calcularOcorrencias, type RecorrenciaParaMaterializar } from './materializacao'

function recorrencia(overrides: Partial<RecorrenciaParaMaterializar> = {}): RecorrenciaParaMaterializar {
  return {
    diaSemana: 2, // terça
    horaLocal: '14:00',
    duracaoMin: 50,
    modalidade: 'presencial',
    vigenciaInicio: '2026-01-01',
    vigenciaFim: null,
    ...overrides
  }
}

describe('calcularOcorrencias', () => {
  it('gera uma ocorrência por semana, sempre no mesmo dia/hora', () => {
    const ocorrencias = calcularOcorrencias(recorrencia(), '2026-03-01', '2026-03-29')
    // terças de março/2026 dentro da janela: 03, 10, 17, 24
    expect(ocorrencias.map((o) => o.inicioUtc)).toEqual([
      '2026-03-03T17:00:00.000Z',
      '2026-03-10T17:00:00.000Z',
      '2026-03-17T17:00:00.000Z',
      '2026-03-24T17:00:00.000Z'
    ])
    expect(ocorrencias.every((o) => o.duracaoMin === 50 && o.modalidade === 'presencial')).toBe(true)
  })

  it('horizonteInicio no meio da semana ainda encontra a próxima terça, sem pular nem duplicar', () => {
    const ocorrencias = calcularOcorrencias(recorrencia(), '2026-03-04', '2026-03-11')
    expect(ocorrencias.map((o) => o.inicioUtc)).toEqual(['2026-03-10T17:00:00.000Z'])
  })

  it('horizonteInicio EXATAMENTE no dia da recorrência inclui essa ocorrência', () => {
    const ocorrencias = calcularOcorrencias(recorrencia(), '2026-03-03', '2026-03-04')
    expect(ocorrencias.map((o) => o.inicioUtc)).toEqual(['2026-03-03T17:00:00.000Z'])
  })

  it('respeita vigenciaInicio: não gera ocorrência antes dela mesmo se a janela pedir', () => {
    const ocorrencias = calcularOcorrencias(recorrencia({ vigenciaInicio: '2026-03-11' }), '2026-03-01', '2026-03-29')
    // primeira terça só a partir de 11/03 é 17/03
    expect(ocorrencias.map((o) => o.inicioUtc)).toEqual(['2026-03-17T17:00:00.000Z', '2026-03-24T17:00:00.000Z'])
  })

  it('respeita vigenciaFim: para de gerar a partir da data de encerramento (exclusiva)', () => {
    const ocorrencias = calcularOcorrencias(recorrencia({ vigenciaFim: '2026-03-17' }), '2026-03-01', '2026-03-29')
    expect(ocorrencias.map((o) => o.inicioUtc)).toEqual(['2026-03-03T17:00:00.000Z', '2026-03-10T17:00:00.000Z'])
  })

  it('janela inteiramente antes da vigência: lista vazia', () => {
    expect(calcularOcorrencias(recorrencia({ vigenciaInicio: '2026-06-01' }), '2026-01-01', '2026-02-01')).toEqual([])
  })

  it('janela inteiramente depois do encerramento: lista vazia', () => {
    expect(calcularOcorrencias(recorrencia({ vigenciaFim: '2026-02-01' }), '2026-03-01', '2026-04-01')).toEqual([])
  })

  it('sessão de 31/01 23:00 local: virada de mês/dia correta em UTC', () => {
    const ocorrencias = calcularOcorrencias(
      recorrencia({ diaSemana: 6, horaLocal: '23:00', vigenciaInicio: '2026-01-31' }),
      '2026-01-31',
      '2026-02-01'
    )
    expect(ocorrencias.map((o) => o.inicioUtc)).toEqual(['2026-02-01T02:00:00.000Z'])
  })

  it('duas recorrências independentes (dias diferentes) não se misturam', () => {
    const segunda = calcularOcorrencias(recorrencia({ diaSemana: 1 }), '2026-03-01', '2026-03-15')
    const quinta = calcularOcorrencias(recorrencia({ diaSemana: 4 }), '2026-03-01', '2026-03-15')
    expect(segunda.map((o) => o.inicioUtc)).toEqual(['2026-03-02T17:00:00.000Z', '2026-03-09T17:00:00.000Z'])
    expect(quinta.map((o) => o.inicioUtc)).toEqual(['2026-03-05T17:00:00.000Z', '2026-03-12T17:00:00.000Z'])
  })

  it('horizonte de 12 semanas gera exatamente 12 ocorrências', () => {
    const ocorrencias = calcularOcorrencias(recorrencia({ vigenciaInicio: '2026-03-03' }), '2026-03-03', '2026-05-26')
    expect(ocorrencias).toHaveLength(12)
  })
})
