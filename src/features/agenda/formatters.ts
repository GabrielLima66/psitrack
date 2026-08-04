import { TIME_ZONE } from './tempo'

const FORMATADOR_HORA_SP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
})

export function formatarHoraLocal(isoUtc: string): string {
  return FORMATADOR_HORA_SP.format(new Date(isoUtc))
}

/** `dataYMD` é 'YYYY-MM-DD' puro — manipulação de string, nunca `new Date()` direto (mesmo raciocínio de formatarDataBr). */
export function formatarDataCurta(dataYMD: string): string {
  const [, mes, dia] = dataYMD.split('-')
  return `${dia}/${mes}`
}

const DIA_SEMANA_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export function formatarDiaSemanaAbrev(diaSemana: number): string {
  return DIA_SEMANA_LABELS[diaSemana] ?? String(diaSemana)
}

const STATUS_SESSAO_LABELS: Record<string, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  remarcada: 'Remarcada',
  cancelada_profissional: 'Cancelada',
  falta_sem_aviso: 'Falta sem aviso',
  falta_com_aviso: 'Falta com aviso'
}

export function formatarStatusSessao(status: string): string {
  return STATUS_SESSAO_LABELS[status] ?? status
}

const MODALIDADE_LABELS: Record<string, string> = {
  presencial: 'Presencial',
  online: 'Online'
}

export function formatarModalidade(modalidade: string): string {
  return MODALIDADE_LABELS[modalidade] ?? modalidade
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
]

/** 'YYYY-MM-DD' → "3 a 9 de agosto" (ou "29 de julho a 4 de agosto" se cruzar o mês). Linha de contexto da Agenda. */
export function formatarIntervaloDatas(inicio: string, fim: string): string {
  const [, mesInicioStr, diaInicioStr] = inicio.split('-')
  const [, mesFimStr, diaFimStr] = fim.split('-')
  const diaInicio = Number(diaInicioStr)
  const diaFim = Number(diaFimStr)
  const nomeMesFim = MESES[Number(mesFimStr) - 1]
  if (mesInicioStr === mesFimStr) return `${diaInicio} a ${diaFim} de ${nomeMesFim}`
  const nomeMesInicio = MESES[Number(mesInicioStr) - 1]
  return `${diaInicio} de ${nomeMesInicio} a ${diaFim} de ${nomeMesFim}`
}
