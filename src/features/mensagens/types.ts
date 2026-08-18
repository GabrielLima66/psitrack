import type { ModalidadeAtendimento, Sessao, StatusSessao } from '../agenda/types'

/**
 * Cópia deliberada da forma dos DTOs de electron/preload/index.ts — mesma
 * razão de sempre (ver src/features/pacientes/types.ts): a fronteira entre
 * tsconfig.web.json e tsconfig.node.json não aceita `import type` de vários
 * arquivos do preload de forma estável (TS6307). `ModalidadeAtendimento`,
 * `Sessao` e `StatusSessao` são reaproveitados de ../agenda/types porque ali
 * já está dentro do mesmo projeto (tsconfig.web.json) — não cruza a
 * fronteira, então não precisa duplicar de novo.
 */

export type { ModalidadeAtendimento, StatusSessao }

/** Flat de propósito — sem `tipo`, só existe um uso hoje (confirmação de sessão). */
export interface MensagemTemplate {
  id: string
  nome: string
  corpo: string // placeholders: {paciente} {data} {hora} {modalidade}
  padrao: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface MensagemTemplateInput {
  nome: string
  corpo: string
  padrao?: boolean
}

export interface SessaoConfirmacao extends Sessao {
  pacienteNome: string
  pacienteNomeSocial: string | null
  telefoneContato: string | null
}
