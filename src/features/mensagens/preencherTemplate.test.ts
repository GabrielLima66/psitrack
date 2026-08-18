import { describe, expect, it } from 'vitest'
import { dadosConfirmacaoDeSessao, preencherTemplate } from './preencherTemplate'
import type { SessaoConfirmacao } from './types'

function sessaoConfirmacao(overrides: Partial<SessaoConfirmacao> = {}): SessaoConfirmacao {
  return {
    id: 's1',
    pacienteId: 'p1',
    recorrenciaId: null,
    inicioUtc: '2026-03-10T17:00:00.000Z', // 14:00 em America/Sao_Paulo
    duracaoMin: 50,
    modalidade: 'presencial',
    status: 'agendada',
    statusAlteradoEm: null,
    avisadaEm: null,
    lembreteEnviadoEm: null,
    motivo: null,
    remarcadaParaId: null,
    observacao: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    pacienteNome: 'Maria da Silva',
    pacienteNomeSocial: null,
    telefoneContato: '5511987654321',
    ...overrides
  }
}

describe('dadosConfirmacaoDeSessao', () => {
  it('usa nomeSocial quando presente', () => {
    const dados = dadosConfirmacaoDeSessao(sessaoConfirmacao({ pacienteNomeSocial: 'Mari' }))
    expect(dados.paciente).toBe('Mari')
  })

  it('cai pro nome quando não há nomeSocial', () => {
    const dados = dadosConfirmacaoDeSessao(sessaoConfirmacao({ pacienteNomeSocial: null }))
    expect(dados.paciente).toBe('Maria da Silva')
  })

  it('formata data, hora e modalidade', () => {
    const dados = dadosConfirmacaoDeSessao(sessaoConfirmacao())
    expect(dados.data).toBe('10/03')
    expect(dados.hora).toBe('14:00')
    expect(dados.modalidade).toBe('Presencial')
  })
})

describe('preencherTemplate', () => {
  it('substitui todos os placeholders, inclusive repetidos', () => {
    const resultado = preencherTemplate('Oi {paciente}! Confirmando {paciente} pra {data} às {hora} ({modalidade}).', {
      paciente: 'Mari',
      data: '10/03',
      hora: '14:00',
      modalidade: 'Presencial'
    })
    expect(resultado).toBe('Oi Mari! Confirmando Mari pra 10/03 às 14:00 (Presencial).')
  })

  it('placeholder desconhecido fica intocado', () => {
    const resultado = preencherTemplate('Oi {paciente}, {outroCampo}', {
      paciente: 'Mari',
      data: '10/03',
      hora: '14:00',
      modalidade: 'Presencial'
    })
    expect(resultado).toBe('Oi Mari, {outroCampo}')
  })
})
