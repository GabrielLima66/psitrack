export interface PagadorCandidato {
  nome: string
  cpf: string | null
}

/**
 * Default do pagador (Etapa 13/SPEC-fase-2.md §7): responsável com
 * `pagador = true`, senão a própria paciente. "Paciente menor com
 * responsável pagador → recibo sai no CPF do responsável" é isto —
 * função pura pra ficar testável sem depender de UI.
 */
export function escolherPagadorPadrao(
  paciente: PagadorCandidato,
  responsaveis: (PagadorCandidato & { pagador: boolean })[]
): PagadorCandidato {
  const pagador = responsaveis.find((r) => r.pagador)
  return pagador ? { nome: pagador.nome, cpf: pagador.cpf } : paciente
}
