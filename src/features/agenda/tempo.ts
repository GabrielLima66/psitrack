/**
 * Mesma lógica de electron/main/db/timezone.ts, duplicada aqui porque o
 * renderer não pode importar de electron/main/** (módulos Node-only,
 * fronteira de projeto TS diferente — mesma razão de types.ts). Deriva o
 * deslocamento via Intl.DateTimeFormat, nunca hardcoda offset.
 */

export const TIME_ZONE = 'America/Sao_Paulo'

function offsetMinutosEm(instanteUtc: Date): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(instanteUtc)
  const obter = (tipo: string): number => Number(partes.find((p) => p.type === tipo)?.value)
  const comoUtc = Date.UTC(obter('year'), obter('month') - 1, obter('day'), obter('hour'), obter('minute'), obter('second'))
  return (comoUtc - instanteUtc.getTime()) / 60_000
}

export function localParaUtc(dataYMD: string, horaHHMM: string): string {
  const [ano, mes, dia] = dataYMD.split('-').map(Number)
  const [hora, minuto] = horaHHMM.split(':').map(Number)
  const chute = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto))
  const offsetMin = offsetMinutosEm(chute)
  return new Date(chute.getTime() - offsetMin * 60_000).toISOString()
}

export function utcParaDataLocal(isoUtc: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(isoUtc))
  const obter = (tipo: string): string => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${obter('year')}-${obter('month')}-${obter('day')}`
}

export function hojeLocal(): string {
  return utcParaDataLocal(new Date().toISOString())
}

export function diaSemanaLocal(dataYMD: string): number {
  const [ano, mes, dia] = dataYMD.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
}

export function somarDias(dataYMD: string, dias: number): string {
  const [ano, mes, dia] = dataYMD.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

/** Domingo da semana que contém `dataYMD` (semana dom-sáb, mesma numeração de `diaSemana` no schema: 0=dom). */
export function inicioDaSemana(dataYMD: string): string {
  return somarDias(dataYMD, -diaSemanaLocal(dataYMD))
}
