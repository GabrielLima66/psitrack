const FORMATADOR_ANO_MES_SP = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit'
})

/**
 * `competencia` é sempre a data LOCAL (America/Sao_Paulo) da sessão, nunca a
 * UTC — a virada do mês é local (SPEC-fase-2.md §4.4). Sessão de 31/01 23:00
 * local já é 01/02 de madrugada em UTC; sem fixar `timeZone` explícito (não
 * o fuso do sistema), isso viraria competência errada.
 */
export function calcularCompetencia(inicioUtc: string): string {
  const partes = FORMATADOR_ANO_MES_SP.formatToParts(new Date(inicioUtc))
  const ano = partes.find((parte) => parte.type === 'year')?.value
  const mes = partes.find((parte) => parte.type === 'month')?.value
  if (!ano || !mes) throw new Error('Não foi possível calcular a competência.')
  return `${ano}-${mes}`
}
