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
