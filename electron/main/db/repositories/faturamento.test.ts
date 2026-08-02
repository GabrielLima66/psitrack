import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { criarContratoPreco } from './contratoPreco'
import { criarEvolucao, retificarEvolucao } from './evolucao'
import {
  alterarStatusSessaoComCobranca,
  criarEvolucaoComCobranca,
  criarEvolucaoComSessaoRetroativa,
  reajustarContrato,
  remarcarSessaoComCobranca,
  retificarEvolucaoComCobranca
} from './faturamento'
import { obterLancamentoPorSessao } from './lancamento'
import { criarPaciente } from './pacientes'
import { criarSessaoAvulsa, obterSessaoOuFalhar } from './sessao'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'migrations')

let db: PsiTrackDatabase
let cleanup: () => void
let pacienteId: string

beforeEach(() => {
  const temp = createTempDbPath()
  cleanup = temp.cleanup
  db = openDatabase({ filePath: temp.filePath, dek: randomBytes(32) })
  runMigrations(db, MIGRATIONS_FOLDER)
  pacienteId = criarPaciente(db, { nome: 'Paciente Teste' }).id
})

afterEach(() => {
  db.$client.close()
  cleanup()
})

function contratoPadrao(overrides: Partial<Parameters<typeof criarContratoPreco>[2]> = {}) {
  return criarContratoPreco(db, pacienteId, {
    modalidade: 'avulso',
    valorCentavos: 15000,
    politicaFalta: 'cobra_sem_aviso',
    avisoMinimoHoras: 24,
    vigenciaInicio: '2026-01-01',
    ...overrides
  })
}

function sessaoEm(dataLocal: string, horaLocal = '14:00') {
  return criarSessaoAvulsa(db, { pacienteId, dataLocal, horaLocal, duracaoMin: 50, modalidade: 'presencial' })
}

describe('processarCobranca', () => {
  it('sessão realizada com contrato vigente gera lançamento pendente com valor congelado', () => {
    contratoPadrao()
    const sessao = sessaoEm('2026-03-10')
    alterarStatusSessaoComCobranca(db, sessao.id, { status: 'realizada' })

    const lancamento = obterLancamentoPorSessao(db, sessao.id)
    expect(lancamento?.status).toBe('pendente')
    expect(lancamento?.valorCentavos).toBe(15000)
    expect(lancamento?.competencia).toBe('2026-03')
  })

  it('paciente sem contrato vigente: sessão marcada, sem lançamento, pendência sinalizada — nunca cobrada como zero', () => {
    const sessao = sessaoEm('2026-03-10') // sem contrato nenhum
    const resultado = alterarStatusSessaoComCobranca(db, sessao.id, { status: 'realizada' })

    expect(resultado.sessao.status).toBe('realizada')
    expect(resultado.lancamento).toBeNull()
    expect(resultado.pendenciaSemContrato).toBe(true)
    expect(obterLancamentoPorSessao(db, sessao.id)).toBeUndefined()
  })

  it('agendada/remarcada/cancelada não geram lançamento nem pendência', () => {
    contratoPadrao()
    const sessao = sessaoEm('2026-03-10')
    const resultado = alterarStatusSessaoComCobranca(db, sessao.id, { status: 'cancelada_profissional' })
    expect(resultado.lancamento).toBeNull()
    expect(resultado.pendenciaSemContrato).toBe(false)
  })
})

describe('critério: falta avisada — 30h/24h não cobra, 12h cobra', () => {
  it('30h de antecedência com mínimo de 24h: sem cobrança', () => {
    contratoPadrao({ politicaFalta: 'cobra_sem_aviso', avisoMinimoHoras: 24 })
    const sessao = sessaoEm('2026-03-10', '14:00') // 2026-03-10T17:00:00Z
    const resultado = alterarStatusSessaoComCobranca(db, sessao.id, {
      status: 'falta_com_aviso',
      avisadaEm: '2026-03-09T11:00:00.000Z' // 30h antes
    })
    expect(resultado.lancamento).toBeNull()
  })

  it('12h de antecedência com mínimo de 24h: cobra', () => {
    contratoPadrao({ politicaFalta: 'cobra_sem_aviso', avisoMinimoHoras: 24 })
    const sessao = sessaoEm('2026-03-10', '14:00')
    const resultado = alterarStatusSessaoComCobranca(db, sessao.id, {
      status: 'falta_com_aviso',
      avisadaEm: '2026-03-10T05:00:00.000Z' // 12h antes
    })
    expect(resultado.lancamento?.tipo).toBe('falta')
    expect(resultado.lancamento?.valorCentavos).toBe(15000)
  })
})

describe('evolução dispara cobrança (D15)', () => {
  it('registrar evolução tipo=sessao com sessaoId marca realizada e cobra', () => {
    contratoPadrao()
    const sessao = sessaoEm('2026-03-10')
    const resultado = criarEvolucaoComCobranca(db, {
      pacienteId,
      conteudo: 'Sessão sobre ansiedade.',
      dataSessao: '2026-03-10',
      tipo: 'sessao',
      sessaoId: sessao.id
    })
    expect(resultado.lancamento).not.toBeNull()
    expect(obterSessaoOuFalhar(db, sessao.id).status).toBe('realizada')
  })

  it('evolução tipo=contato não gera lançamento nem mexe na sessão', () => {
    contratoPadrao()
    const sessao = sessaoEm('2026-03-10')
    const resultado = criarEvolucaoComCobranca(db, {
      pacienteId,
      conteudo: 'Ligou pra remarcar.',
      dataSessao: '2026-03-10',
      tipo: 'contato',
      sessaoId: sessao.id
    })
    expect(resultado.lancamento).toBeNull()
    expect(obterSessaoOuFalhar(db, sessao.id).status).toBe('agendada')
  })

  it('evolução tipo=administrativo não gera lançamento', () => {
    contratoPadrao()
    const sessao = sessaoEm('2026-03-10')
    const resultado = criarEvolucaoComCobranca(db, {
      pacienteId,
      conteudo: 'Nota administrativa.',
      dataSessao: '2026-03-10',
      tipo: 'administrativo',
      sessaoId: sessao.id
    })
    expect(resultado.lancamento).toBeNull()
  })

  it('registrar a mesma sessão duas vezes (original + retificação) gera UM lançamento só', () => {
    contratoPadrao()
    const sessao = sessaoEm('2026-03-10')
    const original = criarEvolucaoComCobranca(db, {
      pacienteId,
      conteudo: 'Texto original.',
      dataSessao: '2026-03-10',
      tipo: 'sessao',
      sessaoId: sessao.id
    })
    expect(original.lancamento).not.toBeNull()
    const idPrimeiroLancamento = original.lancamento!.id

    const retificacao = retificarEvolucaoComCobranca(db, {
      retificaId: original.evolucao.id,
      conteudo: 'Texto corrigido.',
      dataSessao: '2026-03-10',
      tipo: 'sessao',
      motivoRetificacao: 'Corrigindo um erro de digitação.'
    })
    expect(retificacao.lancamento?.id).toBe(idPrimeiroLancamento) // mesmo lançamento, não duplicou

    // Confere no banco: só existe 1 lançamento pra essa sessão.
    expect(obterLancamentoPorSessao(db, sessao.id)?.id).toBe(idPrimeiroLancamento)
  })

  it('retificação herda o sessaoId do original mesmo sem informar de novo', () => {
    contratoPadrao()
    const sessao = sessaoEm('2026-03-10')
    const original = criarEvolucao(db, { pacienteId, conteudo: 'A', dataSessao: '2026-03-10', tipo: 'sessao', sessaoId: sessao.id })
    const retificacao = retificarEvolucao(db, {
      retificaId: original.id,
      conteudo: 'B',
      dataSessao: '2026-03-10',
      tipo: 'sessao',
      motivoRetificacao: 'motivo'
    })
    expect(retificacao.sessaoId).toBe(sessao.id)
  })
})

describe('encaixe (D22): origem nunca cobra', () => {
  it('origem sem lançamento; destino com lançamento quando realizada', () => {
    contratoPadrao()
    const origem = sessaoEm('2026-03-10', '14:00')
    const { destino } = remarcarSessaoComCobranca(db, origem.id, { dataLocal: '2026-03-12', horaLocal: '16:00' })

    expect(obterLancamentoPorSessao(db, origem.id)).toBeUndefined()

    const resultado = alterarStatusSessaoComCobranca(db, destino.id, { status: 'realizada' })
    expect(resultado.lancamento).not.toBeNull()
    expect(obterLancamentoPorSessao(db, origem.id)).toBeUndefined() // continua sem, mesmo depois do destino cobrar
  })

  it('remarcar cancela lançamento pendente que a origem já tivesse (segurança extra do D22)', () => {
    contratoPadrao()
    const origem = sessaoEm('2026-03-10', '14:00')
    alterarStatusSessaoComCobranca(db, origem.id, { status: 'realizada' })
    expect(obterLancamentoPorSessao(db, origem.id)?.status).toBe('pendente')

    remarcarSessaoComCobranca(db, origem.id, { dataLocal: '2026-03-12', horaLocal: '16:00' })
    const lancamentoOrigem = obterLancamentoPorSessao(db, origem.id)
    expect(lancamentoOrigem?.status).toBe('cancelado')
  })
})

describe('bloqueio de status quando já pago (D21)', () => {
  it('bloqueia mudar status de sessão com lançamento pago', () => {
    contratoPadrao()
    const sessao = sessaoEm('2026-03-10')
    alterarStatusSessaoComCobranca(db, sessao.id, { status: 'realizada' })
    const lancamento = obterLancamentoPorSessao(db, sessao.id)!
    db.$client.prepare("UPDATE lancamento SET status = 'pago' WHERE id = ?").run(lancamento.id)

    expect(() => alterarStatusSessaoComCobranca(db, sessao.id, { status: 'falta_sem_aviso' })).toThrow()
  })

  it('desfazer status pendente (voltar pra agendada) cancela o lançamento', () => {
    contratoPadrao()
    const sessao = sessaoEm('2026-03-10')
    alterarStatusSessaoComCobranca(db, sessao.id, { status: 'realizada' })
    expect(obterLancamentoPorSessao(db, sessao.id)?.status).toBe('pendente')

    alterarStatusSessaoComCobranca(db, sessao.id, { status: 'agendada' })
    expect(obterLancamentoPorSessao(db, sessao.id)?.status).toBe('cancelado')
  })
})

describe('reajuste retroativo (D21/D11)', () => {
  it('não altera lançamento já criado, e avisa quantos lançamentos existem no período afetado', () => {
    contratoPadrao({ vigenciaInicio: '2026-01-01', valorCentavos: 15000 })
    const sessao = sessaoEm('2026-03-10')
    alterarStatusSessaoComCobranca(db, sessao.id, { status: 'realizada' })
    const valorOriginal = obterLancamentoPorSessao(db, sessao.id)?.valorCentavos

    const { lancamentosNoPeriodoAfetado } = reajustarContrato(db, pacienteId, {
      modalidade: 'avulso',
      valorCentavos: 20000,
      vigenciaInicio: '2026-03-01' // retroativo, cobre a competência 2026-03onde já existe lançamento
    })

    expect(lancamentosNoPeriodoAfetado).toBe(1)
    expect(obterLancamentoPorSessao(db, sessao.id)?.valorCentavos).toBe(valorOriginal) // não mudou
  })

  it('reajuste sem lançamentos no período afetado avisa zero', () => {
    contratoPadrao({ vigenciaInicio: '2026-01-01' })
    const { lancamentosNoPeriodoAfetado } = reajustarContrato(db, pacienteId, {
      modalidade: 'avulso',
      valorCentavos: 20000,
      vigenciaInicio: '2026-06-01'
    })
    expect(lancamentosNoPeriodoAfetado).toBe(0)
  })
})

describe('evolução avulsa sem sessão: oferece sessão retroativa', () => {
  it('aceitando, cria sessão realizada + evolução vinculada + cobrança', () => {
    contratoPadrao()
    const resultado = criarEvolucaoComSessaoRetroativa(db, {
      pacienteId,
      dataLocal: '2026-03-10',
      horaLocal: '14:00',
      modalidade: 'presencial',
      conteudo: 'Sessão que esqueci de agendar.'
    })
    expect(resultado.sessao.status).toBe('realizada')
    expect(resultado.evolucao.sessaoId).toBe(resultado.sessao.id)
    expect(resultado.lancamento).not.toBeNull()
  })

  it('recusando (evolução sem sessaoId), nunca há cobrança', () => {
    contratoPadrao()
    const resultado = criarEvolucaoComCobranca(db, {
      pacienteId,
      conteudo: 'Sessão avulsa, não quis vincular sessão.',
      dataSessao: '2026-03-10',
      tipo: 'sessao'
    })
    expect(resultado.lancamento).toBeNull()
    expect(resultado.evolucao.sessaoId).toBeNull()
  })
})
