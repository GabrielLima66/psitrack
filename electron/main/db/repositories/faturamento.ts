import { and, eq, gte, isNull } from 'drizzle-orm'
import { calcularCompetencia } from '../competencia'
import { decidirCobranca, type StatusSessaoCobravel } from '../cobranca'
import type { PsiTrackDatabase } from '../connection'
import { lancamento } from '../schema'
import { utcParaDataLocal } from '../timezone'
import { criarContratoPreco, precoVigenteEm, type ContratoPreco, type ContratoPrecoInput } from './contratoPreco'
import { criarEvolucao, retificarEvolucao, type CriarEvolucaoInput, type Evolucao, type RetificarEvolucaoInput } from './evolucao'
import { cancelarLancamento, criarLancamentoDeSessao, obterLancamentoPorSessao, type Lancamento } from './lancamento'
import {
  alterarStatusSessao,
  criarSessaoAvulsa,
  obterSessaoOuFalhar,
  remarcarSessao,
  type AlterarStatusSessaoInput,
  type CriarSessaoAvulsaInput,
  type RemarcarSessaoInput,
  type Sessao
} from './sessao'

const STATUS_COBRAVEIS = new Set<string>(['realizada', 'falta_sem_aviso', 'falta_com_aviso'])

export interface ResultadoFaturamento {
  lancamento: Lancamento | null
  /** true quando a sessão seria cobrável mas não há contrato vigente na data — nunca cobra como zero, só sinaliza. */
  pendenciaSemContrato: boolean
}

function descricaoAuto(tipo: 'sessao' | 'falta', dataLocal: string): string {
  return tipo === 'sessao' ? `Sessão realizada em ${dataLocal}` : `Falta em ${dataLocal}`
}

/**
 * Único ponto que cria lançamento a partir de uma sessão (D15) — idempotente
 * por construção: se já existe lançamento pra essa sessão (índice único
 * `idx_lancamento_sessao`), devolve ele sem tentar de novo. É assim que
 * "registrar a evolução duas vezes (original + retificação)" nunca duplica
 * cobrança, e que mudar o status na agenda usa exatamente a mesma regra que
 * a evolução usa.
 */
export function processarCobranca(db: PsiTrackDatabase, sessaoId: string): ResultadoFaturamento {
  const existente = obterLancamentoPorSessao(db, sessaoId)
  if (existente) return { lancamento: existente, pendenciaSemContrato: false }

  const sessao = obterSessaoOuFalhar(db, sessaoId)
  const dataLocal = utcParaDataLocal(sessao.inicioUtc)
  const contrato = precoVigenteEm(db, sessao.pacienteId, dataLocal)

  if (!contrato || contrato.modalidade === 'encerrado' || contrato.valorCentavos == null) {
    return { lancamento: null, pendenciaSemContrato: STATUS_COBRAVEIS.has(sessao.status) }
  }

  const resultado = decidirCobranca(
    { status: sessao.status as StatusSessaoCobravel, inicioUtc: sessao.inicioUtc, avisadaEm: sessao.avisadaEm },
    { valorCentavos: contrato.valorCentavos, politicaFalta: contrato.politicaFalta, avisoMinimoHoras: contrato.avisoMinimoHoras }
  )

  if (!resultado.cobra) return { lancamento: null, pendenciaSemContrato: false }

  const lancamento = criarLancamentoDeSessao(db, {
    pacienteId: sessao.pacienteId,
    sessaoId,
    tipo: resultado.tipo,
    valorCentavos: resultado.valorCentavos,
    competencia: calcularCompetencia(sessao.inicioUtc),
    descricao: descricaoAuto(resultado.tipo, dataLocal)
  })
  return { lancamento, pendenciaSemContrato: false }
}

/**
 * Ponto de entrada da agenda (mudança de status manual). Bloqueia qualquer
 * mudança se já existe lançamento `pago` pra essa sessão — "marcou errado"
 * depois de pago vira lançamento de ajuste, nunca reescrita do que já foi
 * cobrado (D21).
 */
export function alterarStatusSessaoComCobranca(
  db: PsiTrackDatabase,
  sessaoId: string,
  input: AlterarStatusSessaoInput
): { sessao: Sessao } & ResultadoFaturamento {
  const existente = obterLancamentoPorSessao(db, sessaoId)
  if (existente && existente.status === 'pago') {
    throw new Error('Esta sessão já tem lançamento pago — não é possível mudar o status. Registre um lançamento de ajuste.')
  }

  const sessao = alterarStatusSessao(db, sessaoId, input)

  if (existente && existente.status === 'pendente' && !STATUS_COBRAVEIS.has(sessao.status)) {
    cancelarLancamento(db, existente.id)
    return { sessao, lancamento: null, pendenciaSemContrato: false }
  }

  return { sessao, ...processarCobranca(db, sessaoId) }
}

/** Encaixe (D22): a origem nunca cobra — se por algum motivo já tinha lançamento pendente, cancela. */
export function remarcarSessaoComCobranca(
  db: PsiTrackDatabase,
  origemId: string,
  input: RemarcarSessaoInput
): { origem: Sessao; destino: Sessao } {
  const resultado = remarcarSessao(db, origemId, input)
  const existente = obterLancamentoPorSessao(db, origemId)
  if (existente && existente.status === 'pendente') cancelarLancamento(db, existente.id)
  return resultado
}

/**
 * Evolução é o gatilho do dia a dia (D15/§2.1): registrar `tipo='sessao'`
 * com `sessaoId` marca a sessão como `realizada` e cobra pelo mesmo caminho
 * da agenda. `tipo='contato'|'administrativo'` ou sem `sessaoId` nunca gera
 * lançamento.
 */
export function criarEvolucaoComCobranca(db: PsiTrackDatabase, input: CriarEvolucaoInput): { evolucao: Evolucao } & ResultadoFaturamento {
  return db.$client.transaction((): { evolucao: Evolucao } & ResultadoFaturamento => {
    const evolucao = criarEvolucao(db, input)
    if (evolucao.tipo !== 'sessao' || !evolucao.sessaoId) {
      return { evolucao, lancamento: null, pendenciaSemContrato: false }
    }
    alterarStatusSessao(db, evolucao.sessaoId, { status: 'realizada' })
    return { evolucao, ...processarCobranca(db, evolucao.sessaoId) }
  })()
}

export function retificarEvolucaoComCobranca(
  db: PsiTrackDatabase,
  input: RetificarEvolucaoInput
): { evolucao: Evolucao } & ResultadoFaturamento {
  return db.$client.transaction((): { evolucao: Evolucao } & ResultadoFaturamento => {
    const evolucao = retificarEvolucao(db, input)
    if (evolucao.tipo !== 'sessao' || !evolucao.sessaoId) {
      return { evolucao, lancamento: null, pendenciaSemContrato: false }
    }
    alterarStatusSessao(db, evolucao.sessaoId, { status: 'realizada' })
    return { evolucao, ...processarCobranca(db, evolucao.sessaoId) }
  })()
}

/**
 * Reajuste (I3) é só uma linha nova de `contratoPreco` — nunca reescreve
 * lançamento já criado (D21, garantido por construção: `criarLancamentoDeSessao`
 * congela o valor na hora e nada aqui faz UPDATE em `lancamento`). O que
 * esta função faz a mais é só avisar: conta quantos lançamentos não
 * cancelados já existem na competência afetada pra vigência retroativa,
 * pra usuária saber que eles NÃO vão ser recalculados.
 */
export function reajustarContrato(
  db: PsiTrackDatabase,
  pacienteId: string,
  input: ContratoPrecoInput
): { contrato: ContratoPreco; lancamentosNoPeriodoAfetado: number } {
  const competenciaAfetada = input.vigenciaInicio.slice(0, 7)
  const lancamentosNoPeriodoAfetado = db
    .select()
    .from(lancamento)
    .where(
      and(
        eq(lancamento.pacienteId, pacienteId),
        isNull(lancamento.deletedAt),
        gte(lancamento.competencia, competenciaAfetada)
      )
    )
    .all().length

  const contrato = criarContratoPreco(db, pacienteId, input)
  return { contrato, lancamentosNoPeriodoAfetado }
}

export interface CriarEvolucaoComSessaoRetroativaInput {
  pacienteId: string
  dataLocal: string
  horaLocal: string
  duracaoMin?: number
  modalidade: CriarSessaoAvulsaInput['modalidade']
  conteudo: string
}

/**
 * "Evolução avulsa sem sessão oferece criar a sessão retroativa" (critério
 * de aceite da Etapa 12): quem chama já perguntou pra usuária e recebeu sim
 * — aqui só materializa a sessão (já `realizada`, é retroativa) + a
 * evolução vinculada + a cobrança, tudo atômico.
 */
export function criarEvolucaoComSessaoRetroativa(
  db: PsiTrackDatabase,
  input: CriarEvolucaoComSessaoRetroativaInput
): { evolucao: Evolucao; sessao: Sessao } & ResultadoFaturamento {
  return db.$client.transaction((): { evolucao: Evolucao; sessao: Sessao } & ResultadoFaturamento => {
    const sessaoCriada = criarSessaoAvulsa(db, {
      pacienteId: input.pacienteId,
      dataLocal: input.dataLocal,
      horaLocal: input.horaLocal,
      duracaoMin: input.duracaoMin,
      modalidade: input.modalidade
    })
    const sessao = alterarStatusSessao(db, sessaoCriada.id, { status: 'realizada' })
    const evolucao = criarEvolucao(db, {
      pacienteId: input.pacienteId,
      conteudo: input.conteudo,
      dataSessao: input.dataLocal,
      tipo: 'sessao',
      sessaoId: sessao.id
    })
    return { evolucao, sessao, ...processarCobranca(db, sessao.id) }
  })()
}
