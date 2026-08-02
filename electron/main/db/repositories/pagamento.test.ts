import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { criarContratoPreco } from './contratoPreco'
import { criarLancamentoAjuste, listarLancamentosPaciente } from './lancamento'
import { marcarReciboEmitido, registrarPagamento } from './pagamento'
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
  criarContratoPreco(db, pacienteId, { modalidade: 'avulso', valorCentavos: 15000, vigenciaInicio: '2026-01-01' })
})

afterEach(() => {
  db.$client.close()
  cleanup()
})

describe('registrarPagamento', () => {
  it('valorCentavos é sempre a soma dos lançamentos vinculados, nunca o que o input mandar', () => {
    const l1 = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 15000, descricao: 'Sessão 1', competencia: '2026-03' })
    const l2 = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 15000, descricao: 'Sessão 2', competencia: '2026-03' })

    const pagamento = registrarPagamento(db, pacienteId, {
      lancamentoIds: [l1.id, l2.id],
      data: '2026-03-15',
      meio: 'pix',
      pagadorNome: 'Paciente Teste'
    })

    expect(pagamento.valorCentavos).toBe(30000) // soma real, não um valor arbitrário do input
  })

  it('marca os lançamentos vinculados como pago, sem alterar o valor deles', () => {
    const l1 = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 15000, descricao: 'Sessão 1', competencia: '2026-03' })
    const valorOriginal = l1.valorCentavos

    registrarPagamento(db, pacienteId, {
      lancamentoIds: [l1.id],
      data: '2026-03-15',
      meio: 'pix',
      pagadorNome: 'Paciente Teste'
    })

    const [atualizado] = listarLancamentosPaciente(db, pacienteId)
    expect(atualizado?.status).toBe('pago')
    expect(atualizado?.valorCentavos).toBe(valorOriginal) // registrar pagamento não altera valor de lançamento nenhum
  })

  it('bloqueia vincular um lançamento já pago a um segundo pagamento', () => {
    const l1 = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 15000, descricao: 'Sessão 1', competencia: '2026-03' })
    registrarPagamento(db, pacienteId, { lancamentoIds: [l1.id], data: '2026-03-15', meio: 'pix', pagadorNome: 'Paciente Teste' })

    expect(() =>
      registrarPagamento(db, pacienteId, { lancamentoIds: [l1.id], data: '2026-03-16', meio: 'dinheiro', pagadorNome: 'Paciente Teste' })
    ).toThrow()
  })

  it('bloqueia pagar lançamento cancelado', () => {
    const l1 = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 15000, descricao: 'x', competencia: '2026-03' })
    db.$client.prepare("UPDATE lancamento SET status = 'cancelado' WHERE id = ?").run(l1.id)
    expect(() =>
      registrarPagamento(db, pacienteId, { lancamentoIds: [l1.id], data: '2026-03-15', meio: 'pix', pagadorNome: 'Paciente Teste' })
    ).toThrow()
  })

  it('paciente menor com responsável pagador: recibo sai no CPF do responsável (snapshot, não FK)', () => {
    const l1 = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 15000, descricao: 'x', competencia: '2026-03' })
    const pagamento = registrarPagamento(db, pacienteId, {
      lancamentoIds: [l1.id],
      data: '2026-03-15',
      meio: 'pix',
      pagadorNome: 'Mãe da Paciente',
      pagadorCpf: '11144477735'
    })
    expect(pagamento.pagadorNome).toBe('Mãe da Paciente')
    expect(pagamento.pagadorCpf).toBe('11144477735')
  })
})

describe('marcarReciboEmitido', () => {
  it('grava data e referência de emissão', () => {
    const l1 = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 15000, descricao: 'x', competencia: '2026-03' })
    const pagamento = registrarPagamento(db, pacienteId, { lancamentoIds: [l1.id], data: '2026-03-15', meio: 'pix', pagadorNome: 'X' })

    const atualizado = marcarReciboEmitido(db, pagamento.id, { data: '2026-03-16', referencia: 'RS-000123' })
    expect(atualizado.reciboEmitidoEm).toBe('2026-03-16')
    expect(atualizado.reciboReferencia).toBe('RS-000123')
  })
})
