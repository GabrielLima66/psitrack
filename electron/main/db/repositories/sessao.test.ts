import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { criarPaciente } from './pacientes'
import { criarRecorrencia, type Recorrencia } from './recorrencia'
import {
  alterarStatusSessao,
  criarSessaoAvulsa,
  encerrarSerie,
  listarSessoesPeriodo,
  materializarRecorrencia,
  materializarTodasRecorrencias,
  remarcarSessao,
  sobreposicaoHorario
} from './sessao'

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

function novaRecorrencia(overrides: Partial<Parameters<typeof criarRecorrencia>[2]> = {}): Recorrencia {
  return criarRecorrencia(db, pacienteId, {
    diaSemana: 2,
    horaLocal: '14:00',
    duracaoMin: 50,
    modalidade: 'presencial',
    vigenciaInicio: '2026-01-01',
    ...overrides
  })
}

describe('materializarRecorrencia', () => {
  it('gera 12 semanas de ocorrências a partir de hoje', () => {
    const rec = novaRecorrencia()
    const geradas = materializarRecorrencia(db, rec, '2026-01-06') // uma terça
    expect(geradas).toBe(12)
    expect(listarSessoesPeriodo(db, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z')).toHaveLength(12)
  })

  it('rodar de novo no mesmo horizonte não duplica (extensão incremental)', () => {
    const rec = novaRecorrencia()
    materializarRecorrencia(db, rec, '2026-01-06')
    const segundaRodada = materializarRecorrencia(db, rec, '2026-01-06')
    expect(segundaRodada).toBe(0)
    expect(listarSessoesPeriodo(db, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z')).toHaveLength(12)
  })

  it('abrir o app numa semana seguinte estende o horizonte sem duplicar ocorrência', () => {
    const rec = novaRecorrencia()
    materializarRecorrencia(db, rec, '2026-01-06')
    const extensao = materializarRecorrencia(db, rec, '2026-01-13') // "hoje" avançou 1 semana
    expect(extensao).toBe(1) // só a nova semana no fim do horizonte
    expect(listarSessoesPeriodo(db, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z')).toHaveLength(13)
  })
})

describe('materializarTodasRecorrencias', () => {
  it('materializa todas as recorrências ativas de todos os pacientes', () => {
    novaRecorrencia({ diaSemana: 1 })
    novaRecorrencia({ diaSemana: 4 })
    const total = materializarTodasRecorrencias(db, '2026-01-06')
    expect(total).toBe(24)
  })
})

describe('criarSessaoAvulsa', () => {
  it('cria fora de qualquer recorrência, com horário local convertido pra UTC', () => {
    const s = criarSessaoAvulsa(db, {
      pacienteId,
      dataLocal: '2026-03-10',
      horaLocal: '14:00',
      duracaoMin: 50,
      modalidade: 'presencial'
    })
    expect(s.recorrenciaId).toBeNull()
    expect(s.inicioUtc).toBe('2026-03-10T17:00:00.000Z')
    expect(s.status).toBe('agendada')
  })
})

describe('alterarStatusSessao', () => {
  it('muda status e grava motivo', () => {
    const s = criarSessaoAvulsa(db, {
      pacienteId,
      dataLocal: '2026-03-10',
      horaLocal: '14:00',
      modalidade: 'presencial'
    })
    const atualizada = alterarStatusSessao(db, s.id, { status: 'falta_sem_aviso', motivo: 'não compareceu' })
    expect(atualizada.status).toBe('falta_sem_aviso')
    expect(atualizada.motivo).toBe('não compareceu')
    expect(atualizada.statusAlteradoEm).not.toBeNull()
  })

  it('cancelar uma ocorrência não afeta as demais', () => {
    const rec = novaRecorrencia()
    materializarRecorrencia(db, rec, '2026-01-06')
    const sessoes = listarSessoesPeriodo(db, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z')
    const alvo = sessoes[0]!
    alterarStatusSessao(db, alvo.id, { status: 'cancelada_profissional', motivo: 'imprevisto' })

    const depois = listarSessoesPeriodo(db, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z')
    expect(depois.find((s) => s.id === alvo.id)?.status).toBe('cancelada_profissional')
    expect(depois.filter((s) => s.id !== alvo.id && s.status !== 'agendada')).toHaveLength(0)
  })
})

describe('remarcarSessao (encaixe)', () => {
  it('liga origem e destino; origem fica remarcada, destino nasce agendada', () => {
    const origem = criarSessaoAvulsa(db, {
      pacienteId,
      dataLocal: '2026-03-10',
      horaLocal: '14:00',
      modalidade: 'presencial'
    })

    const { origem: origemAtualizada, destino } = remarcarSessao(db, origem.id, {
      dataLocal: '2026-03-12',
      horaLocal: '16:00'
    })

    expect(origemAtualizada.status).toBe('remarcada')
    expect(origemAtualizada.remarcadaParaId).toBe(destino.id)
    expect(destino.status).toBe('agendada')
    expect(destino.inicioUtc).toBe('2026-03-12T19:00:00.000Z')
    expect(destino.pacienteId).toBe(pacienteId)
  })
})

describe('encerrarSerie', () => {
  it('grava vigenciaFim e cancela (soft-delete) só as ocorrências futuras ainda agendada', () => {
    const rec = novaRecorrencia()
    materializarRecorrencia(db, rec, '2026-01-06')

    const antes = listarSessoesPeriodo(db, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z')
    const primeira = antes[0]!
    alterarStatusSessao(db, primeira.id, { status: 'realizada' })

    encerrarSerie(db, rec.id, '2026-01-20')

    const depois = listarSessoesPeriodo(db, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z')
    // a realizada continua existindo
    expect(depois.find((s) => s.id === primeira.id)?.status).toBe('realizada')
    // só sobram as que já passaram (antes do corte) — as futuras 'agendada' foram removidas
    expect(depois.every((s) => s.inicioUtc < '2026-01-20T00:00:00.000Z' || s.id === primeira.id)).toBe(true)
  })
})

describe('sobreposicaoHorario', () => {
  it('detecta colisão de horário (aviso, não bloqueio)', () => {
    criarSessaoAvulsa(db, { pacienteId, dataLocal: '2026-03-10', horaLocal: '14:00', duracaoMin: 50, modalidade: 'presencial' })
    const colisoes = sobreposicaoHorario(db, '2026-03-10T17:20:00.000Z', 50)
    expect(colisoes).toHaveLength(1)
  })

  it('sem colisão quando os horários não se tocam', () => {
    criarSessaoAvulsa(db, { pacienteId, dataLocal: '2026-03-10', horaLocal: '14:00', duracaoMin: 50, modalidade: 'presencial' })
    const colisoes = sobreposicaoHorario(db, '2026-03-10T19:00:00.000Z', 50)
    expect(colisoes).toHaveLength(0)
  })

  it('cancelada_profissional não conta como ocupando o horário', () => {
    const s = criarSessaoAvulsa(db, { pacienteId, dataLocal: '2026-03-10', horaLocal: '14:00', duracaoMin: 50, modalidade: 'presencial' })
    alterarStatusSessao(db, s.id, { status: 'cancelada_profissional' })
    const colisoes = sobreposicaoHorario(db, '2026-03-10T17:20:00.000Z', 50)
    expect(colisoes).toHaveLength(0)
  })
})
