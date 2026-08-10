import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { criarPaciente } from './pacientes'
import { conflitosRecorrencia, criarRecorrencia, encerrarRecorrencia, listarRecorrencias } from './recorrencia'

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

describe('criarRecorrencia / listarRecorrencias', () => {
  it('cria e lista', () => {
    criarRecorrencia(db, pacienteId, {
      diaSemana: 2,
      horaLocal: '14:00',
      duracaoMin: 50,
      modalidade: 'presencial',
      vigenciaInicio: '2026-01-01'
    })
    const lista = listarRecorrencias(db, pacienteId)
    expect(lista).toHaveLength(1)
    expect(lista[0]?.diaSemana).toBe(2)
    expect(lista[0]?.vigenciaFim).toBeNull()
  })

  it('paciente com dois horários fixos gera duas séries independentes', () => {
    criarRecorrencia(db, pacienteId, {
      diaSemana: 1,
      horaLocal: '10:00',
      duracaoMin: 50,
      modalidade: 'presencial',
      vigenciaInicio: '2026-01-01'
    })
    criarRecorrencia(db, pacienteId, {
      diaSemana: 4,
      horaLocal: '16:00',
      duracaoMin: 50,
      modalidade: 'online',
      vigenciaInicio: '2026-01-01'
    })
    expect(listarRecorrencias(db, pacienteId)).toHaveLength(2)
  })

  it('rejeita hora fora do formato HH:MM', () => {
    expect(() =>
      criarRecorrencia(db, pacienteId, {
        diaSemana: 2,
        horaLocal: '25:00',
        duracaoMin: 50,
        modalidade: 'presencial',
        vigenciaInicio: '2026-01-01'
      })
    ).toThrow()
  })
})

describe('encerrarRecorrencia', () => {
  it('grava vigenciaFim sem apagar a linha', () => {
    const rec = criarRecorrencia(db, pacienteId, {
      diaSemana: 2,
      horaLocal: '14:00',
      duracaoMin: 50,
      modalidade: 'presencial',
      vigenciaInicio: '2026-01-01'
    })
    const encerrada = encerrarRecorrencia(db, rec.id, '2026-06-01')
    expect(encerrada.vigenciaFim).toBe('2026-06-01')
    expect(listarRecorrencias(db, pacienteId)).toHaveLength(1) // ainda listada, não é soft-delete
  })

  it('encerrar uma série não afeta a outra', () => {
    const serie1 = criarRecorrencia(db, pacienteId, {
      diaSemana: 1,
      horaLocal: '10:00',
      duracaoMin: 50,
      modalidade: 'presencial',
      vigenciaInicio: '2026-01-01'
    })
    criarRecorrencia(db, pacienteId, {
      diaSemana: 4,
      horaLocal: '16:00',
      duracaoMin: 50,
      modalidade: 'online',
      vigenciaInicio: '2026-01-01'
    })

    encerrarRecorrencia(db, serie1.id, '2026-06-01')

    const lista = listarRecorrencias(db, pacienteId)
    const outraSerie = lista.find((r) => r.diaSemana === 4)
    expect(outraSerie?.vigenciaFim).toBeNull()
  })
})

describe('conflitosRecorrencia', () => {
  it('detecta outro paciente com recorrência ativa no mesmo dia e horário que se sobrepõe', () => {
    const outroId = criarPaciente(db, { nome: 'Outro Paciente' }).id
    criarRecorrencia(db, outroId, { diaSemana: 2, horaLocal: '14:00', duracaoMin: 50, modalidade: 'presencial', vigenciaInicio: '2026-01-01' })

    const conflitos = conflitosRecorrencia(db, pacienteId, {
      diaSemana: 2,
      horaLocal: '14:20',
      duracaoMin: 50,
      vigenciaInicio: '2026-01-01'
    })

    expect(conflitos).toHaveLength(1)
    expect(conflitos[0]?.pacienteId).toBe(outroId)
    expect(conflitos[0]?.pacienteNome).toBe('Outro Paciente')
  })

  it('não conflita com a própria recorrência do mesmo paciente', () => {
    criarRecorrencia(db, pacienteId, { diaSemana: 2, horaLocal: '14:00', duracaoMin: 50, modalidade: 'presencial', vigenciaInicio: '2026-01-01' })

    const conflitos = conflitosRecorrencia(db, pacienteId, {
      diaSemana: 2,
      horaLocal: '14:00',
      duracaoMin: 50,
      vigenciaInicio: '2026-01-01'
    })

    expect(conflitos).toHaveLength(0)
  })

  it('sem conflito em dia da semana diferente', () => {
    const outroId = criarPaciente(db, { nome: 'Outro Paciente' }).id
    criarRecorrencia(db, outroId, { diaSemana: 3, horaLocal: '14:00', duracaoMin: 50, modalidade: 'presencial', vigenciaInicio: '2026-01-01' })

    const conflitos = conflitosRecorrencia(db, pacienteId, {
      diaSemana: 2,
      horaLocal: '14:00',
      duracaoMin: 50,
      vigenciaInicio: '2026-01-01'
    })

    expect(conflitos).toHaveLength(0)
  })

  it('sem conflito quando os horários não se tocam', () => {
    const outroId = criarPaciente(db, { nome: 'Outro Paciente' }).id
    criarRecorrencia(db, outroId, { diaSemana: 2, horaLocal: '14:00', duracaoMin: 50, modalidade: 'presencial', vigenciaInicio: '2026-01-01' })

    const conflitos = conflitosRecorrencia(db, pacienteId, {
      diaSemana: 2,
      horaLocal: '15:00',
      duracaoMin: 50,
      vigenciaInicio: '2026-01-01'
    })

    expect(conflitos).toHaveLength(0)
  })

  it('sem conflito quando a recorrência do outro paciente já foi encerrada antes da nova começar', () => {
    const outroId = criarPaciente(db, { nome: 'Outro Paciente' }).id
    const recOutro = criarRecorrencia(db, outroId, {
      diaSemana: 2,
      horaLocal: '14:00',
      duracaoMin: 50,
      modalidade: 'presencial',
      vigenciaInicio: '2026-01-01'
    })
    encerrarRecorrencia(db, recOutro.id, '2026-03-01')

    const conflitos = conflitosRecorrencia(db, pacienteId, {
      diaSemana: 2,
      horaLocal: '14:00',
      duracaoMin: 50,
      vigenciaInicio: '2026-06-01'
    })

    expect(conflitos).toHaveLength(0)
  })

  it('paciente novo (pacienteId null) ainda detecta conflito contra pacientes existentes', () => {
    const outroId = criarPaciente(db, { nome: 'Outro Paciente' }).id
    criarRecorrencia(db, outroId, { diaSemana: 5, horaLocal: '09:00', duracaoMin: 50, modalidade: 'presencial', vigenciaInicio: '2026-01-01' })

    const conflitos = conflitosRecorrencia(db, null, {
      diaSemana: 5,
      horaLocal: '09:00',
      duracaoMin: 50,
      vigenciaInicio: '2026-01-01'
    })

    expect(conflitos).toHaveLength(1)
  })
})
