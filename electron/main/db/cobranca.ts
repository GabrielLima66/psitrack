export type StatusSessaoCobravel =
  | 'agendada'
  | 'realizada'
  | 'remarcada'
  | 'cancelada_profissional'
  | 'falta_sem_aviso'
  | 'falta_com_aviso'

export type PoliticaFalta = 'cobra_sempre' | 'cobra_sem_aviso' | 'nunca_cobra'

export interface SessaoParaCobranca {
  status: StatusSessaoCobravel
  inicioUtc: string
  avisadaEm: string | null
}

export interface ContratoParaCobranca {
  valorCentavos: number
  politicaFalta: PoliticaFalta
  avisoMinimoHoras: number
}

export type ResultadoCobranca =
  | { cobra: false }
  | { cobra: true; tipo: 'sessao' | 'falta'; valorCentavos: number }

const HORA_EM_MS = 3_600_000

/**
 * Função pura — sessão é a única âncora de cobrança (SPEC-fase-2.md D15):
 * um lugar só onde dinheiro nasce, independente de vir da agenda ou do
 * atalho "registrar evolução". `remarcada` (encaixe) nunca cobra: quem
 * cobra é a sessão de destino, não a de origem (D22).
 */
export function decidirCobranca(sessao: SessaoParaCobranca, contrato: ContratoParaCobranca): ResultadoCobranca {
  switch (sessao.status) {
    case 'agendada':
    case 'remarcada':
    case 'cancelada_profissional':
      return { cobra: false }

    case 'realizada':
      return { cobra: true, tipo: 'sessao', valorCentavos: contrato.valorCentavos }

    case 'falta_sem_aviso':
      return contrato.politicaFalta === 'nunca_cobra'
        ? { cobra: false }
        : { cobra: true, tipo: 'falta', valorCentavos: contrato.valorCentavos }

    case 'falta_com_aviso': {
      if (contrato.politicaFalta === 'cobra_sempre') {
        return { cobra: true, tipo: 'falta', valorCentavos: contrato.valorCentavos }
      }
      if (contrato.politicaFalta === 'nunca_cobra') {
        return { cobra: false }
      }
      // cobra_sem_aviso: cobra só se o aviso não deu antecedência suficiente.
      // Sem avisadaEm registrado (dado inconsistente — status diz que avisou
      // mas não há timestamp), trata como aviso insuficiente: fail-safe pro
      // lado de cobrar, nunca de perder receita por dado faltando.
      if (!sessao.avisadaEm) {
        return { cobra: true, tipo: 'falta', valorCentavos: contrato.valorCentavos }
      }
      const horasDeAntecedencia = (new Date(sessao.inicioUtc).getTime() - new Date(sessao.avisadaEm).getTime()) / HORA_EM_MS
      return horasDeAntecedencia < contrato.avisoMinimoHoras
        ? { cobra: true, tipo: 'falta', valorCentavos: contrato.valorCentavos }
        : { cobra: false }
    }
  }
}
