import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { contratoPreco } from '../schema'
import { createTempDbPath } from '../test-support'
import { uuidv7 } from '../uuidv7'
import { criarPaciente } from './pacientes'
import { criarContratoPreco, listarContratosPaciente, precoVigenteEm } from './contratoPreco'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'migrations')

let db: PsiTrackDatabase
let cleanup: () => void
let pacienteId: string

function inserirContrato(input: {
  modalidade: 'avulso' | 'mensal' | 'encerrado'
  valorCentavos: number | null
  vigenciaInicio: string
}): void {
  const now = new Date().toISOString()
  db.insert(contratoPreco)
    .values({
      id: uuidv7(),
      pacienteId,
      modalidade: input.modalidade,
      valorCentavos: input.valorCentavos,
      vigenciaInicio: input.vigenciaInicio,
      createdAt: now,
      updatedAt: now
    })
    .run()
}

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

describe('precoVigenteEm', () => {
  it('sem contrato nenhum: undefined', () => {
    expect(precoVigenteEm(db, pacienteId, '2026-06-01')).toBeUndefined()
  })

  it('um contrato: vale em qualquer data a partir da vigência', () => {
    inserirContrato({ modalidade: 'avulso', valorCentavos: 10000, vigenciaInicio: '2026-01-01' })

    expect(precoVigenteEm(db, pacienteId, '2026-01-01')?.valorCentavos).toBe(10000)
    expect(precoVigenteEm(db, pacienteId, '2026-06-15')?.valorCentavos).toBe(10000)
  })

  it('antes da vigência inicial: undefined', () => {
    inserirContrato({ modalidade: 'avulso', valorCentavos: 10000, vigenciaInicio: '2026-01-01' })
    expect(precoVigenteEm(db, pacienteId, '2025-12-31')).toBeUndefined()
  })

  it('três reajustes: cada período retorna o valor certo, sem sobreposição', () => {
    inserirContrato({ modalidade: 'avulso', valorCentavos: 10000, vigenciaInicio: '2026-01-01' }) // R$100
    inserirContrato({ modalidade: 'avulso', valorCentavos: 12000, vigenciaInicio: '2026-04-01' }) // R$120
    inserirContrato({ modalidade: 'avulso', valorCentavos: 13000, vigenciaInicio: '2026-07-01' }) // R$130
    inserirContrato({ modalidade: 'avulso', valorCentavos: 15000, vigenciaInicio: '2026-10-01' }) // R$150

    expect(precoVigenteEm(db, pacienteId, '2026-02-01')?.valorCentavos).toBe(10000)
    expect(precoVigenteEm(db, pacienteId, '2026-04-01')?.valorCentavos).toBe(12000) // exatamente na virada
    expect(precoVigenteEm(db, pacienteId, '2026-06-30')?.valorCentavos).toBe(12000)
    expect(precoVigenteEm(db, pacienteId, '2026-08-15')?.valorCentavos).toBe(13000)
    expect(precoVigenteEm(db, pacienteId, '2026-12-31')?.valorCentavos).toBe(15000)
  })

  it('encerrado: consulta depois da vigência de encerramento retorna a linha "encerrado" (valor null)', () => {
    inserirContrato({ modalidade: 'avulso', valorCentavos: 10000, vigenciaInicio: '2026-01-01' })
    inserirContrato({ modalidade: 'encerrado', valorCentavos: null, vigenciaInicio: '2026-06-01' })

    const vigente = precoVigenteEm(db, pacienteId, '2026-07-01')
    expect(vigente?.modalidade).toBe('encerrado')
    expect(vigente?.valorCentavos).toBeNull()
  })

  it('reaberto: novo contrato após o encerramento volta a valer, sem reviver o "encerrado"', () => {
    inserirContrato({ modalidade: 'avulso', valorCentavos: 10000, vigenciaInicio: '2026-01-01' })
    inserirContrato({ modalidade: 'encerrado', valorCentavos: null, vigenciaInicio: '2026-06-01' })
    inserirContrato({ modalidade: 'mensal', valorCentavos: 20000, vigenciaInicio: '2026-09-01' })

    // enquanto encerrado
    expect(precoVigenteEm(db, pacienteId, '2026-07-01')?.modalidade).toBe('encerrado')
    // depois de reaberto
    const reaberto = precoVigenteEm(db, pacienteId, '2026-10-01')
    expect(reaberto?.modalidade).toBe('mensal')
    expect(reaberto?.valorCentavos).toBe(20000)
  })
})

describe('criarContratoPreco', () => {
  it('cria contrato com valores default de política e aviso mínimo', () => {
    const contrato = criarContratoPreco(db, pacienteId, {
      modalidade: 'avulso',
      valorCentavos: 15000,
      vigenciaInicio: '2026-01-01'
    })
    expect(contrato.politicaFalta).toBe('cobra_sem_aviso')
    expect(contrato.avisoMinimoHoras).toBe(24)
    expect(precoVigenteEm(db, pacienteId, '2026-02-01')?.valorCentavos).toBe(15000)
  })

  it('rejeita valor não-positivo', () => {
    expect(() =>
      criarContratoPreco(db, pacienteId, { modalidade: 'avulso', valorCentavos: 0, vigenciaInicio: '2026-01-01' })
    ).toThrow()
  })

  it('rejeita valor float', () => {
    expect(() =>
      criarContratoPreco(db, pacienteId, { modalidade: 'avulso', valorCentavos: 150.5, vigenciaInicio: '2026-01-01' })
    ).toThrow()
  })
})

describe('listarContratosPaciente', () => {
  it('lista todo o histórico, mais recente primeiro', () => {
    criarContratoPreco(db, pacienteId, { modalidade: 'avulso', valorCentavos: 10000, vigenciaInicio: '2026-01-01' })
    criarContratoPreco(db, pacienteId, { modalidade: 'avulso', valorCentavos: 12000, vigenciaInicio: '2026-04-01' })

    const historico = listarContratosPaciente(db, pacienteId)
    expect(historico).toHaveLength(2)
    expect(historico[0]?.vigenciaInicio).toBe('2026-04-01')
    expect(historico[1]?.vigenciaInicio).toBe('2026-01-01')
  })
})
