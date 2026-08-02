import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { criarAnotacao } from './anotacoes'
import { criarContratoPreco } from './contratoPreco'
import { criarEvolucao } from './evolucao'
import { criarLancamentoAjuste } from './lancamento'
import { registrarPagamento } from './pagamento'
import { criarPaciente } from './pacientes'
import { gerarCsvRelatorio, gerarRelatorioMensal } from './relatorio'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'migrations')
const MARCADOR_PRIVADO = 'ZZ_CONTEUDO_QUE_NUNCA_PODE_VAZAR_PRO_RELATORIO_ZZ'
const MARCADOR_EVOLUCAO = 'ZZ_EVOLUCAO_QUE_NUNCA_PODE_VAZAR_PRO_RELATORIO_ZZ'

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

describe('gerarRelatorioMensal — regime de caixa', () => {
  it('entra pela data do PAGAMENTO, não pela competência do lançamento', () => {
    // lançamento é de fevereiro, mas o pagamento só acontece em março
    const l1 = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 15000, descricao: 'x', competencia: '2026-02' })
    registrarPagamento(db, pacienteId, { lancamentoIds: [l1.id], data: '2026-03-05', meio: 'pix', pagadorNome: 'X' })

    expect(gerarRelatorioMensal(db, '2026-02').pagamentos).toHaveLength(0)
    expect(gerarRelatorioMensal(db, '2026-03').pagamentos).toHaveLength(1)
  })

  it('recebido por meio soma corretamente, separado por meio de pagamento', () => {
    const l1 = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 10000, descricao: 'a', competencia: '2026-03' })
    const l2 = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 20000, descricao: 'b', competencia: '2026-03' })
    registrarPagamento(db, pacienteId, { lancamentoIds: [l1.id], data: '2026-03-05', meio: 'pix', pagadorNome: 'X' })
    registrarPagamento(db, pacienteId, { lancamentoIds: [l2.id], data: '2026-03-10', meio: 'dinheiro', pagadorNome: 'X' })

    const relatorio = gerarRelatorioMensal(db, '2026-03')
    const porMeio = Object.fromEntries(relatorio.recebidoPorMeio.map((r) => [r.meio, r.totalCentavos]))
    expect(porMeio.pix).toBe(10000)
    expect(porMeio.dinheiro).toBe(20000)
  })

  it('em aberto por paciente soma os lançamentos pendentes, independente do mês', () => {
    criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 15000, descricao: 'x', competencia: '2026-05' })
    const relatorio = gerarRelatorioMensal(db, '2026-03')
    expect(relatorio.emAbertoPorPaciente).toHaveLength(1)
    expect(relatorio.emAbertoPorPaciente[0]?.totalCentavos).toBe(15000)
  })
})

describe('gerarCsvRelatorio — export local, nunca vaza dado clínico', () => {
  it('linha do CSV tem nome, cpf, valor e data — nada além disso', () => {
    const l1 = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 15000, descricao: 'x', competencia: '2026-03' })
    registrarPagamento(db, pacienteId, {
      lancamentoIds: [l1.id],
      data: '2026-03-15',
      meio: 'pix',
      pagadorNome: 'Paciente Teste',
      pagadorCpf: '11144477735'
    })
    const csv = gerarCsvRelatorio(gerarRelatorioMensal(db, '2026-03'))
    const linhas = csv.split('\n')
    expect(linhas[0]).toBe('nome,cpf,valor,data')
    expect(linhas[1]).toBe('Paciente Teste,11144477735,150.00,2026-03-15')
  })

  it('NUNCA inclui conteúdo de prontuario_evolucao nem anotacao_privada (estende o teste da Etapa 8)', () => {
    criarAnotacao(db, pacienteId, { titulo: 'Sigiloso', conteudo: MARCADOR_PRIVADO })
    criarEvolucao(db, { pacienteId, conteudo: MARCADOR_EVOLUCAO, dataSessao: '2026-03-10', tipo: 'sessao' })
    const l1 = criarLancamentoAjuste(db, pacienteId, { tipo: 'ajuste', valorCentavos: 15000, descricao: 'x', competencia: '2026-03' })
    registrarPagamento(db, pacienteId, { lancamentoIds: [l1.id], data: '2026-03-15', meio: 'pix', pagadorNome: 'Paciente Teste' })

    const relatorio = gerarRelatorioMensal(db, '2026-03')
    const csv = gerarCsvRelatorio(relatorio)

    expect(JSON.stringify(relatorio)).not.toContain(MARCADOR_PRIVADO)
    expect(JSON.stringify(relatorio)).not.toContain(MARCADOR_EVOLUCAO)
    expect(csv).not.toContain(MARCADOR_PRIVADO)
    expect(csv).not.toContain(MARCADOR_EVOLUCAO)
  })
})
