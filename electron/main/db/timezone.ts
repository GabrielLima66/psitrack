export const TIME_ZONE = 'America/Sao_Paulo'

/** Deslocamento (minutos, UTC − local) que o fuso tem no instante dado. */
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
  const comoUtc = Date.UTC(
    obter('year'),
    obter('month') - 1,
    obter('day'),
    obter('hour'),
    obter('minute'),
    obter('second')
  )
  return (comoUtc - instanteUtc.getTime()) / 60_000
}

/**
 * Hora local (America/Sao_Paulo) → instante UTC, sem hardcodar o
 * deslocamento: o offset é lido via `Intl.DateTimeFormat` (D14 — Brasil não
 * tem horário de verão hoje, mas se voltar o cálculo continua correto).
 */
export function localParaUtc(dataYMD: string, horaHHMM: string): string {
  const [ano, mes, dia] = dataYMD.split('-').map(Number)
  const [hora, minuto] = horaHHMM.split(':').map(Number)
  const chute = new Date(Date.UTC(ano, mes - 1, dia, hora, minuto))
  const offsetMin = offsetMinutosEm(chute)
  return new Date(chute.getTime() - offsetMin * 60_000).toISOString()
}

/** Instante UTC → data local ('YYYY-MM-DD'), pra bookkeeping de materialização (até onde já foi gerado). */
export function utcParaDataLocal(inicioUtc: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(inicioUtc))
  const obter = (tipo: string): string => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${obter('year')}-${obter('month')}-${obter('day')}`
}
