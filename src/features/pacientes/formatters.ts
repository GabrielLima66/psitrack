/**
 * `dataNascimento`/`dataSessao` são 'YYYY-MM-DD' puro, sem hora nem fuso
 * (SPEC-fase-1.md) — nunca passar por `new Date(...)` aqui: o parser
 * interpreta como UTC meia-noite e formatar de volta no fuso local pode
 * exibir o dia errado. Manipulação de string direta, sem matemática de data.
 */
export function formatarDataBr(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split('-')
  return `${dia}/${mes}/${ano}`
}

/**
 * `createdAt` É um timestamp de verdade (UTC ISO-8601, CLAUDE.md invariante
 * de dado #4) — aqui sim precisa converter fuso. `timeZone` fixo em
 * 'America/Sao_Paulo' explícito no Intl.DateTimeFormat, nunca o fuso do
 * sistema operacional: é o que garante a mesma exibição não importa o TZ
 * configurado na máquina (testado trocando `process.env.TZ`).
 */
const FORMATADOR_DATA_HORA_SP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

export function formatarDataHoraBr(isoUtc: string): string {
  return FORMATADOR_DATA_HORA_SP.format(new Date(isoUtc))
}

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  encerrado: 'Encerrado'
}

export function formatarStatus(status: string): string {
  return STATUS_LABELS[status] ?? status
}

const PARENTESCO_LABELS: Record<string, string> = {
  mae: 'Mãe',
  pai: 'Pai',
  avo: 'Avô/Avó',
  tutor: 'Tutor(a)',
  outro: 'Outro'
}

export function formatarParentesco(parentesco: string): string {
  return PARENTESCO_LABELS[parentesco] ?? parentesco
}

const TIPO_EVOLUCAO_LABELS: Record<string, string> = {
  sessao: 'Sessão',
  contato: 'Contato',
  administrativo: 'Administrativo'
}

export function formatarTipoEvolucao(tipo: string): string {
  return TIPO_EVOLUCAO_LABELS[tipo] ?? tipo
}
