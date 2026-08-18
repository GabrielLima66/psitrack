/**
 * Cópia deliberada da forma dos DTOs de electron/preload/index.ts — mesma
 * razão de sempre (ver src/features/pacientes/types.ts): a fronteira entre
 * tsconfig.web.json e tsconfig.node.json não aceita `import type` de vários
 * arquivos do preload de forma estável (TS6307).
 */

export type TipoLancamento = 'sessao' | 'falta' | 'ajuste' | 'desconto'
export type StatusLancamento = 'pendente' | 'pago' | 'cancelado'

export interface Lancamento {
  id: string
  pacienteId: string
  sessaoId: string | null
  competencia: string
  tipo: TipoLancamento
  descricao: string
  valorCentavos: number
  status: StatusLancamento
  pagamentoId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface LancamentoComPaciente extends Lancamento {
  pacienteNome: string
}

export type MeioPagamento = 'pix' | 'dinheiro' | 'transferencia' | 'cartao' | 'outro'

export interface Pagamento {
  id: string
  pacienteId: string
  valorCentavos: number
  data: string
  meio: MeioPagamento
  pagadorNome: string
  pagadorCpf: string | null
  reciboEmitidoEm: string | null
  reciboReferencia: string | null
  estornadoEm: string | null
  motivoEstorno: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface RegistrarPagamentoInput {
  lancamentoIds: string[]
  data: string
  meio: MeioPagamento
  pagadorNome: string
  pagadorCpf?: string | null
}

export interface MarcarReciboEmitidoInput {
  data: string
  referencia: string
}

export interface RecebidoPorMeio {
  meio: string
  totalCentavos: number
}

export interface EmAbertoPorPaciente {
  pacienteId: string
  pacienteNome: string
  totalCentavos: number
}

export interface LinhaPagamentoRelatorio {
  pacienteNome: string
  pagadorNome: string
  pagadorCpf: string | null
  valorCentavos: number
  data: string
}

export interface RelatorioMensal {
  competencia: string
  recebidoPorMeio: RecebidoPorMeio[]
  emAbertoPorPaciente: EmAbertoPorPaciente[]
  pagamentos: LinhaPagamentoRelatorio[]
}

export type ModalidadeContrato = 'avulso' | 'mensal' | 'encerrado'

export interface ContratoPreco {
  id: string
  pacienteId: string
  modalidade: ModalidadeContrato
  valorCentavos: number | null
  vigenciaInicio: string
}
