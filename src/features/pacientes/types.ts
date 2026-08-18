/**
 * Cópia deliberada da forma dos DTOs de electron/preload/index.ts — não é
 * `import type` de lá porque essa fronteira entre projetos TS (composite:
 * tsconfig.web.json só inclui src/**, tsconfig.node.json inclui
 * electron/preload/**) se mostrou instável ao importar de vários arquivos
 * diferentes (funcionava de um só, quebrava com três — TS6307). Mesma
 * lógica de duplicação intencional já usada em recovery-key-input.ts.
 */

export type StatusPaciente = 'ativo' | 'pausado' | 'encerrado'
export type MotivoEncerramento = 'alta' | 'abandono' | 'encaminhamento' | 'outro'
export type OrigemPaciente = 'indicacao' | 'convenio' | 'redes' | 'outro'
export type ParentescoResponsavel = 'mae' | 'pai' | 'avo' | 'tutor' | 'outro'

export interface Paciente {
  id: string
  nome: string
  nomeSocial: string | null
  nomeBusca: string
  dataNascimento: string | null
  cpf: string | null
  telefone: string | null
  email: string | null
  status: StatusPaciente
  motivoEncerramento: MotivoEncerramento | null
  statusAlteradoEm: string | null
  origem: OrigemPaciente | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface PacienteComUltimaSessao extends Paciente {
  ultimaSessao: string | null
}

export interface PacienteInput {
  nome: string
  nomeSocial?: string | null
  dataNascimento?: string | null
  cpf?: string | null
  telefone?: string | null
  email?: string | null
  origem?: OrigemPaciente | null
}

export interface AlterarStatusInput {
  status: StatusPaciente
  motivoEncerramento?: MotivoEncerramento | null
}

export interface ListarPacientesOptions {
  status?: StatusPaciente
  arquivados?: boolean
  busca?: string
}

export interface Responsavel {
  id: string
  pacienteId: string
  nome: string
  cpf: string | null
  parentesco: ParentescoResponsavel
  telefone: string | null
  email: string | null
  principal: boolean
  pagador: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ResponsavelInput {
  nome: string
  cpf?: string | null
  parentesco: ParentescoResponsavel
  telefone?: string | null
  email?: string | null
  principal?: boolean
  pagador?: boolean
}

/**
 * Informações clínicas (SPEC-fase-5.md) — editáveis, ao contrário de
 * `Evolucao`: têm `updatedAt`/`deletedAt` e não passam por retificação (D43).
 */
export interface FichaClinica {
  id: string
  pacienteId: string
  demandaInicial: string | null
  abordagem: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface FichaClinicaInput {
  demandaInicial?: string | null
  abordagem?: string | null
}

export interface Medicamento {
  id: string
  pacienteId: string
  nome: string
  dose: string | null
  prescritor: string | null
  inicio: string | null
  /** `null` = em uso hoje (D44) — o histórico sai do par início/fim, nunca de versionamento. */
  fim: string | null
  observacao: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface MedicamentoInput {
  nome: string
  dose?: string | null
  prescritor?: string | null
  inicio?: string | null
  fim?: string | null
  observacao?: string | null
}

export interface Diagnostico {
  id: string
  pacienteId: string
  descricao: string
  cid: string | null
  data: string | null
  profissional: string | null
  observacao: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface DiagnosticoInput {
  descricao: string
  cid?: string | null
  data?: string | null
  profissional?: string | null
  observacao?: string | null
}

/** De SAÍDA (D47): ela encaminha a paciente pra outro profissional. A entrada é o campo `origem` do cadastro. */
export interface Encaminhamento {
  id: string
  pacienteId: string
  paraQuem: string
  especialidade: string | null
  data: string
  motivo: string | null
  observacao: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface EncaminhamentoInput {
  paraQuem: string
  especialidade?: string | null
  data: string
  motivo?: string | null
  observacao?: string | null
}

export type TipoEvolucao = 'sessao' | 'contato' | 'administrativo'

/** Sem updatedAt/deletedAt — nunca é atualizada nem apagada, correção é `retificaId` apontando pra original. */
export interface Evolucao {
  id: string
  pacienteId: string
  conteudo: string
  retificaId: string | null
  dataSessao: string
  tipo: TipoEvolucao
  motivoRetificacao: string | null
  createdAt: string
}

export interface CriarEvolucaoInput {
  pacienteId: string
  conteudo: string
  dataSessao: string
  tipo: TipoEvolucao
  /** Preenchido pelo atalho "registrar evolução" clicado a partir da agenda (Etapa 11/D17). */
  sessaoId?: string | null
}

export interface RetificarEvolucaoInput {
  retificaId: string
  conteudo: string
  dataSessao: string
  tipo: TipoEvolucao
  motivoRetificacao: string
}

/** "Evolução avulsa sem sessão oferece criar a sessão retroativa" (Etapa 12) — aceitando, cria sessão já `realizada` + evolução vinculada + cobrança, tudo numa transação. */
export interface CriarEvolucaoComSessaoRetroativaInput {
  pacienteId: string
  dataLocal: string
  horaLocal: string
  duracaoMin?: number
  modalidade: 'presencial' | 'online'
  conteudo: string
}

/** NUNCA entra em export (CLAUDE.md invariante de dado #2). Ao contrário de Evolucao: edição e exclusão são livres. */
export interface Anotacao {
  id: string
  pacienteId: string
  titulo: string | null
  conteudo: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface AnotacaoInput {
  titulo?: string | null
  conteudo: string
}

export type ClassificacaoAnexo = 'prontuario' | 'privado'

/**
 * `nonce`/`chaveEnvelopada` são o ciphertext do envelope por arquivo (D25) —
 * não a DEK mestra (essa nunca cruza IPC, invariante de segurança #1 do
 * CLAUDE.md). Inúteis pra quem não tem a DEK, que só existe no main.
 */
export interface Anexo {
  id: string
  pacienteId: string
  evolucaoId: string | null
  classificacao: ClassificacaoAnexo
  nomeOriginal: string
  mime: string
  tamanhoBytes: number
  sha256Cifrado: string
  nonce: string
  chaveEnvelopada: string
  descricao: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface ListarAnexosOptions {
  /** `true` = só a lixeira (soft-deletados); default/false = só os ativos. */
  lixeira?: boolean
}

/** `classificacao` força `'prontuario'` na UI quando `evolucaoId` é passado (D33). */
export interface AnexarViaDialogoInput {
  classificacao: ClassificacaoAnexo
  evolucaoId?: string | null
  descricao?: string | null
}
