import { and, eq, getTableColumns, gte, isNull, lt } from 'drizzle-orm'
import type { PsiTrackDatabase } from '../connection'
import { pacientes, pagamento } from '../schema'
import { listarLancamentosPendentesTodos } from './lancamento'

export interface RecebidoPorMeio {
  meio: string
  totalCentavos: number
}

export interface EmAbertoPorPaciente {
  pacienteId: string
  pacienteNome: string
  totalCentavos: number
}

export interface LinhaPagamentoRelatorio {
  pacienteNome: string
  pagadorNome: string
  pagadorCpf: string | null
  valorCentavos: number
  data: string
}

export interface RelatorioMensal {
  competencia: string
  recebidoPorMeio: RecebidoPorMeio[]
  emAbertoPorPaciente: EmAbertoPorPaciente[]
  pagamentos: LinhaPagamentoRelatorio[]
}

function proximaCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes, 1)) // `mes` sem -1: Date.UTC é 0-indexado, então já avança um mês
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Regime de caixa (critério de aceite da Etapa 13): entra pela DATA DO
 * PAGAMENTO, nunca da sessão/competência do lançamento — por isso filtra
 * `pagamento.data`, não `lancamento.competencia`.
 */
export function gerarRelatorioMensal(db: PsiTrackDatabase, competencia: string): RelatorioMensal {
  const inicio = `${competencia}-01`
  const fim = `${proximaCompetencia(competencia)}-01`

  const pagamentosDoMes = db
    .select({ ...getTableColumns(pagamento), pacienteNome: pacientes.nome })
    .from(pagamento)
    .innerJoin(pacientes, eq(pagamento.pacienteId, pacientes.id))
    .where(and(isNull(pagamento.deletedAt), gte(pagamento.data, inicio), lt(pagamento.data, fim)))
    .all()

  const recebidoPorMeioMap = new Map<string, number>()
  for (const p of pagamentosDoMes) {
    recebidoPorMeioMap.set(p.meio, (recebidoPorMeioMap.get(p.meio) ?? 0) + p.valorCentavos)
  }

  const pendentes = listarLancamentosPendentesTodos(db)
  const emAbertoMap = new Map<string, EmAbertoPorPaciente>()
  for (const l of pendentes) {
    const atual = emAbertoMap.get(l.pacienteId) ?? { pacienteId: l.pacienteId, pacienteNome: l.pacienteNome, totalCentavos: 0 }
    atual.totalCentavos += l.valorCentavos
    emAbertoMap.set(l.pacienteId, atual)
  }

  return {
    competencia,
    recebidoPorMeio: [...recebidoPorMeioMap.entries()].map(([meio, totalCentavos]) => ({ meio, totalCentavos })),
    emAbertoPorPaciente: [...emAbertoMap.values()],
    pagamentos: pagamentosDoMes.map((p) => ({
      pacienteNome: p.pacienteNome,
      pagadorNome: p.pagadorNome,
      pagadorCpf: p.pagadorCpf,
      valorCentavos: p.valorCentavos,
      data: p.data
    }))
  }
}

function escaparCsv(valor: string): string {
  return /[",\n]/.test(valor) ? `"${valor.replaceAll('"', '""')}"` : valor
}

/**
 * "Relação pronta pra transcrição no Receita Saúde" (nome, CPF, valor,
 * data) — só os campos do pagador/pagamento, nunca nada de
 * prontuario_evolucao/anotacao_privada (esta função nem tem acesso a essas
 * tabelas, ver relatorio.test.ts).
 */
export function gerarCsvRelatorio(relatorio: RelatorioMensal): string {
  const linhas = ['nome,cpf,valor,data']
  for (const p of relatorio.pagamentos) {
    const valor = (p.valorCentavos / 100).toFixed(2)
    linhas.push([p.pagadorNome, p.pagadorCpf ?? '', valor, p.data].map(escaparCsv).join(','))
  }
  return linhas.join('\n')
}
