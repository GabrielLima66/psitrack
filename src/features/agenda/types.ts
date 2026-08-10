import type { PacienteInput } from '../pacientes/types'

/**
 * Cópia deliberada da forma dos DTOs de electron/preload/index.ts — mesma
 * razão de sempre (ver src/features/pacientes/types.ts): a fronteira entre
 * tsconfig.web.json e tsconfig.node.json não aceita `import type` de vários
 * arquivos do preload de forma estável (TS6307). `PacienteInput` é
 * reaproveitado de ../pacientes/types porque ali já está dentro do mesmo
 * projeto (tsconfig.web.json) — não cruza a fronteira, então não precisa duplicar de novo.
 */

export type ModalidadeAtendimento = 'presencial' | 'online'

export interface Recorrencia {
  id: string
  pacienteId: string
  diaSemana: number // 0=dom … 6=sáb
  horaLocal: string // 'HH:MM' em America/Sao_Paulo
  duracaoMin: number
  modalidade: ModalidadeAtendimento
  vigenciaInicio: string
  vigenciaFim: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface RecorrenciaInput {
  diaSemana: number
  horaLocal: string
  duracaoMin?: number
  modalidade: ModalidadeAtendimento
  vigenciaInicio: string
}

export interface ConflitoRecorrencia {
  recorrenciaId: string
  pacienteId: string
  pacienteNome: string
  diaSemana: number
  horaLocal: string
  duracaoMin: number
}

export type StatusSessao = 'agendada' | 'realizada' | 'remarcada' | 'cancelada_profissional' | 'falta_sem_aviso' | 'falta_com_aviso'

export interface Sessao {
  id: string
  pacienteId: string
  recorrenciaId: string | null
  inicioUtc: string
  duracaoMin: number
  modalidade: ModalidadeAtendimento
  status: StatusSessao
  statusAlteradoEm: string | null
  avisadaEm: string | null
  motivo: string | null
  remarcadaParaId: string | null
  observacao: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface SessaoComPaciente extends Sessao {
  pacienteNome: string
}

export interface CriarSessaoAvulsaInput {
  pacienteId: string
  dataLocal: string
  horaLocal: string
  duracaoMin?: number
  modalidade: ModalidadeAtendimento
  observacao?: string | null
}

export interface AlterarStatusSessaoInput {
  status: StatusSessao
  motivo?: string | null
  avisadaEm?: string | null
}

export interface RemarcarSessaoInput {
  dataLocal: string
  horaLocal: string
}

export type PoliticaFalta = 'cobra_sempre' | 'cobra_sem_aviso' | 'nunca_cobra'
export type ModalidadeContrato = 'avulso' | 'mensal' | 'encerrado'

export interface ContratoPreco {
  id: string
  pacienteId: string
  modalidade: ModalidadeContrato
  valorCentavos: number | null
  politicaFalta: PoliticaFalta
  avisoMinimoHoras: number
  vigenciaInicio: string
  observacao: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ContratoPrecoInput {
  modalidade: 'avulso' | 'mensal'
  valorCentavos: number
  politicaFalta?: PoliticaFalta
  avisoMinimoHoras?: number
  vigenciaInicio: string
  observacao?: string | null
}

export interface CriarPacienteComAtendimentoInput {
  paciente: PacienteInput
  recorrencias: RecorrenciaInput[]
  contrato: ContratoPrecoInput
}

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

export interface LancamentoAjusteInput {
  tipo: 'ajuste' | 'desconto'
  valorCentavos: number
  descricao: string
  competencia: string
}

export interface ResultadoFaturamento {
  lancamento: Lancamento | null
  pendenciaSemContrato: boolean
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
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface MarcarReciboEmitidoInput {
  data: string
  referencia: string
}
