import { localParaUtc } from './timezone'

export interface RecorrenciaParaMaterializar {
  diaSemana: number // 0=dom … 6=sáb
  horaLocal: string // 'HH:MM' em America/Sao_Paulo
  duracaoMin: number
  modalidade: 'presencial' | 'online'
  vigenciaInicio: string // 'YYYY-MM-DD'
  vigenciaFim: string | null // 'YYYY-MM-DD', null = sem fim. Exclusivo: ocorrências NESSA data em diante não geram.
}

export interface OcorrenciaCalculada {
  inicioUtc: string
  duracaoMin: number
  modalidade: 'presencial' | 'online'
}

function diaSemanaDe(dataYMD: string): number {
  return new Date(`${dataYMD}T00:00:00Z`).getUTCDay()
}

function somarDias(dataYMD: string, dias: number): string {
  const [ano, mes, dia] = dataYMD.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias))
  return data.toISOString().slice(0, 10)
}

function maiorData(a: string, b: string): string {
  return a > b ? a : b
}

function menorData(a: string, b: string): string {
  return a < b ? a : b
}

/**
 * Ocorrências concretas de uma recorrência dentro de uma janela local
 * [horizonteInicio, horizonteFim) — D13/D14. Não decide o que já foi
 * materializado antes (isso é responsabilidade de quem chama, comparando
 * contra o que já existe em `sessao`); esta função é pura: mesma entrada,
 * mesma saída, sempre.
 */
export function calcularOcorrencias(
  recorrencia: RecorrenciaParaMaterializar,
  horizonteInicio: string,
  horizonteFim: string
): OcorrenciaCalculada[] {
  const inicioEfetivo = maiorData(horizonteInicio, recorrencia.vigenciaInicio)
  const fimEfetivo = recorrencia.vigenciaFim ? menorData(horizonteFim, recorrencia.vigenciaFim) : horizonteFim

  if (inicioEfetivo >= fimEfetivo) return []

  const deslocamento = (7 + recorrencia.diaSemana - diaSemanaDe(inicioEfetivo)) % 7
  let dataAtual = somarDias(inicioEfetivo, deslocamento)

  const ocorrencias: OcorrenciaCalculada[] = []
  while (dataAtual < fimEfetivo) {
    ocorrencias.push({
      inicioUtc: localParaUtc(dataAtual, recorrencia.horaLocal),
      duracaoMin: recorrencia.duracaoMin,
      modalidade: recorrencia.modalidade
    })
    dataAtual = somarDias(dataAtual, 7)
  }
  return ocorrencias
}
