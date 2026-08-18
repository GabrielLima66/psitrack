import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { cancelarLancamento, criarLancamentoAjuste, listarLancamentosPaciente, reabrirLancamento } from './lancamento'
import { criarPaciente } from './pacientes'

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

describe('criarLancamentoAjuste', () => {
  it('cria ajuste positivo e desconto negativo', () => {
    const ajuste = criarLancamentoAjuste(db, pacienteId, {
      tipo: 'ajuste',
      valorCentavos: 5000,
      descricao: 'Cobrança retroativa combinada',
      competencia: '2026-03'
    })
    expect(ajuste.status).toBe('pendente')
    expect(ajuste.sessaoId).toBeNull()

    const desconto = criarLancamentoAjuste(db, pacienteId, {
      tipo: 'desconto',
      valorCentavos: -3000,
      descricao: 'Desconto combinado',
      competencia: '2026-03'
    })
    expect(desconto.valorCentavos).toBe(-3000)

    expect(listarLancamentosPaciente(db, pacienteId)).toHaveLength(2)
  })

  it('rejeita valor zero', () => {
    expect(() =>
      criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 0, descricao: 'x', competencia: '2026-03' })
    ).toThrow()
  })
})

describe('cancelarLancamento', () => {
  it('cancela lançamento pendente', () => {
    const l = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 1000, descricao: 'x', competencia: '2026-03' })
    const cancelado = cancelarLancamento(db, l.id)
    expect(cancelado.status).toBe('cancelado')
  })

  it('bloqueia cancelar lançamento já pago', () => {
    const l = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 1000, descricao: 'x', competencia: '2026-03' })
    db.$client.prepare("UPDATE lancamento SET status = 'pago' WHERE id = ?").run(l.id)
    expect(() => cancelarLancamento(db, l.id)).toThrow()
  })
})

describe('reabrirLancamento', () => {
  it('reabre lançamento cancelado de volta pra pendente', () => {
    const l = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 1000, descricao: 'x', competencia: '2026-03' })
    cancelarLancamento(db, l.id)

    const reaberto = reabrirLancamento(db, l.id)
    expect(reaberto.status).toBe('pendente')
  })

  it('bloqueia reabrir um lançamento que não está cancelado', () => {
    const l = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 1000, descricao: 'x', competencia: '2026-03' })
    expect(() => reabrirLancamento(db, l.id)).toThrow()
  })
})
