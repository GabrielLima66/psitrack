/** `dataNascimento` no formato 'YYYY-MM-DD'. Idade é sempre derivada, nunca persistida (SPEC-fase-1.md D5). */
export function calcularIdade(dataNascimento: string, hoje: Date = new Date()): number {
  const [ano, mes, dia] = dataNascimento.split('-').map(Number)
  let idade = hoje.getFullYear() - ano
  const fezAniversarioEsteAno = hoje.getMonth() + 1 > mes || (hoje.getMonth() + 1 === mes && hoje.getDate() >= dia)
  if (!fezAniversarioEsteAno) idade--
  return idade
}

export function isMenorDeIdade(dataNascimento: string, hoje: Date = new Date()): boolean {
  return calcularIdade(dataNascimento, hoje) < 18
}
