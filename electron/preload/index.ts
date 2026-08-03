import { contextBridge, ipcRenderer } from 'electron'

/**
 * Superfície exposta ao renderer. Só DTOs simples cruzam essa fronteira —
 * nunca a DEK, nunca um handle de banco, nunca um Buffer de chave.
 * (invariante de segurança #1 e #2 do CLAUDE.md)
 *
 * Os tipos de DTO abaixo são cópias deliberadas da forma das tabelas em
 * electron/main/db/schema.ts — não é `import type` de lá porque
 * tsconfig.web.json (projeto TS composite) não inclui electron/main/**,
 * só electron/preload/** e src/**; importar de lá arrastaria os arquivos
 * de main (que usam módulos Node-only) pro projeto do renderer. Mesma
 * lógica de duplicação intencional já usada em recovery-key-input.ts.
 */

type IpcResult<T extends object = Record<string, never>> = ({ ok: true } & T) | { ok: false; error: string }

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

/** `ultimaSessao` fica null até a Etapa 7 (evolução clínica) existir de verdade. */
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

/**
 * NUNCA entra em export (CLAUDE.md invariante de dado #2 /
 * electron/main/db/repositories/export.ts). Ao contrário de Evolucao: TEM
 * updatedAt/deletedAt — edição e exclusão são livres aqui.
 */
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

export type ModalidadeAtendimento = 'presencial' | 'online'

/** N por paciente — dois ou mais horários fixos na semana é caso normal (SPEC-fase-2.md §4.1). */
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

export type StatusSessao = 'agendada' | 'realizada' | 'remarcada' | 'cancelada_profissional' | 'falta_sem_aviso' | 'falta_com_aviso'

/** Materializada (D13): ocorrência concreta, nunca regra virtual + exceção calculada em runtime. */
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
  observacao: string | null // logística, NUNCA clínico
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
  valorCentavos: number | null // null quando 'encerrado'
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

/** Paciente + N recorrências + contrato inicial, tudo numa transação (D24). */
export interface CriarPacienteComAtendimentoInput {
  paciente: PacienteInput
  recorrencias: RecorrenciaInput[]
  contrato: ContratoPrecoInput
}

export type TipoLancamento = 'sessao' | 'falta' | 'ajuste' | 'desconto'
export type StatusLancamento = 'pendente' | 'pago' | 'cancelado'

/** Gerado a partir de sessão (`sessaoId` preenchido) ou manual (ajuste/desconto, `sessaoId` null). Valor congelado na criação (D21). */
export interface Lancamento {
  id: string
  pacienteId: string
  sessaoId: string | null
  competencia: string // 'YYYY-MM' da data local da sessão
  tipo: TipoLancamento
  descricao: string
  valorCentavos: number // pode ser negativo (desconto)
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

/** Devolvido por toda ação que pode gerar cobrança (mudar status, evolução) — nunca cobra como zero quando falta contrato (Etapa 12). */
export interface ResultadoFaturamento {
  lancamento: Lancamento | null
  pendenciaSemContrato: boolean
}

export interface CriarEvolucaoComSessaoRetroativaInput {
  pacienteId: string
  dataLocal: string
  horaLocal: string
  duracaoMin?: number
  modalidade: ModalidadeAtendimento
  conteudo: string
}

export interface LancamentoComPaciente extends Lancamento {
  pacienteNome: string
}

export type MeioPagamento = 'pix' | 'dinheiro' | 'transferencia' | 'cartao' | 'outro'

/** `pagadorNome`/`pagadorCpf` são snapshot, não FK (D18) — recibo já emitido continua refletindo quem pagou mesmo que o responsável mude depois. */
export interface Pagamento {
  id: string
  pacienteId: string
  valorCentavos: number
  data: string // regime de caixa
  meio: MeioPagamento
  pagadorNome: string
  pagadorCpf: string | null
  reciboEmitidoEm: string | null
  reciboReferencia: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** `lancamentoIds` decide o valor — o main recalcula a soma, nunca confia num total vindo do renderer. */
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

export interface BackupBlobEntry {
  id: string
  sha256Cifrado: string
  tamanhoBytes: number
}

export interface BackupVerificationResult {
  ok: boolean
  integrityCheck: string
  cipherIntegrityCheckOk: boolean
  rowCounts: Record<string, number>
  rowCountsMatchSource: boolean
  blobs: { ok: boolean; problemas: string[] }
}

export interface BackupManifestDTO {
  createdAt: string
  schemaVersion: number
  verification: BackupVerificationResult
  blobs: { entries: BackupBlobEntry[]; total: number }
}

export type OrigemBackup = 'manual' | 'pre-restore'

export interface BackupListado {
  pasta: string
  origem: OrigemBackup
  tamanhoBytes: number
  manifest: BackupManifestDTO
}

export interface RegistroRestauracao {
  restauradoEm: string
  pastaOrigem: string
}

const api = {
  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
  },
  vault: {
    status: (): Promise<{ exists: boolean }> => ipcRenderer.invoke('vault:status'),
    create: (password: string): Promise<IpcResult<{ recoveryKey: string }>> =>
      ipcRenderer.invoke('vault:create', password),
    unlock: (password: string): Promise<IpcResult> => ipcRenderer.invoke('vault:unlock', password),
    unlockWithRecovery: (recoveryKey: string): Promise<IpcResult> =>
      ipcRenderer.invoke('vault:unlockWithRecovery', recoveryKey),
    completeRecoverySetup: (newPassword: string): Promise<IpcResult<{ recoveryKey: string }>> =>
      ipcRenderer.invoke('vault:completeRecoverySetup', newPassword),
    lock: (): Promise<void> => ipcRenderer.invoke('vault:lock'),
    /** Disparado pelo main quando o auto-lock por inatividade trava a sessão. Devolve a função de cancelar a inscrição. */
    onLocked: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      ipcRenderer.on('vault:locked', listener)
      return () => ipcRenderer.removeListener('vault:locked', listener)
    }
  },
  paciente: {
    criar: (input: PacienteInput): Promise<IpcResult<{ paciente: Paciente }>> => ipcRenderer.invoke('paciente:criar', input),
    atualizar: (id: string, input: PacienteInput): Promise<IpcResult<{ paciente: Paciente }>> =>
      ipcRenderer.invoke('paciente:atualizar', id, input),
    alterarStatus: (id: string, input: AlterarStatusInput): Promise<IpcResult<{ paciente: Paciente }>> =>
      ipcRenderer.invoke('paciente:alterarStatus', id, input),
    obter: (id: string): Promise<IpcResult<{ paciente: Paciente | null }>> => ipcRenderer.invoke('paciente:obter', id),
    listar: (options?: ListarPacientesOptions): Promise<IpcResult<{ pacientes: PacienteComUltimaSessao[] }>> =>
      ipcRenderer.invoke('paciente:listar', options),
    arquivar: (id: string): Promise<IpcResult> => ipcRenderer.invoke('paciente:arquivar', id),
    restaurar: (id: string): Promise<IpcResult> => ipcRenderer.invoke('paciente:restaurar', id),
    criarComAtendimento: (input: CriarPacienteComAtendimentoInput): Promise<IpcResult<{ paciente: Paciente }>> =>
      ipcRenderer.invoke('paciente:criarComAtendimento', input)
  },
  responsavel: {
    listar: (pacienteId: string): Promise<IpcResult<{ responsaveis: Responsavel[] }>> =>
      ipcRenderer.invoke('responsavel:listar', pacienteId),
    criar: (pacienteId: string, input: ResponsavelInput): Promise<IpcResult<{ responsavel: Responsavel }>> =>
      ipcRenderer.invoke('responsavel:criar', pacienteId, input),
    atualizar: (id: string, input: ResponsavelInput): Promise<IpcResult<{ responsavel: Responsavel }>> =>
      ipcRenderer.invoke('responsavel:atualizar', id, input),
    remover: (id: string): Promise<IpcResult> => ipcRenderer.invoke('responsavel:remover', id)
  },
  evolucao: {
    criar: (input: CriarEvolucaoInput): Promise<IpcResult<{ evolucao: Evolucao } & ResultadoFaturamento>> =>
      ipcRenderer.invoke('evolucao:criar', input),
    listar: (pacienteId: string): Promise<IpcResult<{ evolucoes: Evolucao[] }>> =>
      ipcRenderer.invoke('evolucao:listar', pacienteId),
    retificar: (input: RetificarEvolucaoInput): Promise<IpcResult<{ evolucao: Evolucao } & ResultadoFaturamento>> =>
      ipcRenderer.invoke('evolucao:retificar', input),
    criarComSessaoRetroativa: (
      input: CriarEvolucaoComSessaoRetroativaInput
    ): Promise<IpcResult<{ evolucao: Evolucao; sessao: Sessao } & ResultadoFaturamento>> =>
      ipcRenderer.invoke('evolucao:criarComSessaoRetroativa', input)
  },
  anotacao: {
    listar: (pacienteId: string): Promise<IpcResult<{ anotacoes: Anotacao[] }>> =>
      ipcRenderer.invoke('anotacao:listar', pacienteId),
    criar: (pacienteId: string, input: AnotacaoInput): Promise<IpcResult<{ anotacao: Anotacao }>> =>
      ipcRenderer.invoke('anotacao:criar', pacienteId, input),
    atualizar: (id: string, input: AnotacaoInput): Promise<IpcResult<{ anotacao: Anotacao }>> =>
      ipcRenderer.invoke('anotacao:atualizar', id, input),
    excluir: (id: string): Promise<IpcResult> => ipcRenderer.invoke('anotacao:excluir', id)
  },
  recorrencia: {
    listar: (pacienteId: string): Promise<IpcResult<{ recorrencias: Recorrencia[] }>> =>
      ipcRenderer.invoke('recorrencia:listar', pacienteId),
    criar: (pacienteId: string, input: RecorrenciaInput): Promise<IpcResult<{ recorrencia: Recorrencia }>> =>
      ipcRenderer.invoke('recorrencia:criar', pacienteId, input),
    encerrar: (id: string, vigenciaFim: string): Promise<IpcResult<{ recorrencia: Recorrencia }>> =>
      ipcRenderer.invoke('recorrencia:encerrar', id, vigenciaFim)
  },
  sessao: {
    listarPeriodo: (inicioUtc: string, fimUtc: string): Promise<IpcResult<{ sessoes: SessaoComPaciente[] }>> =>
      ipcRenderer.invoke('sessao:listarPeriodo', inicioUtc, fimUtc),
    criarAvulsa: (input: CriarSessaoAvulsaInput): Promise<IpcResult<{ sessao: Sessao }>> =>
      ipcRenderer.invoke('sessao:criarAvulsa', input),
    alterarStatus: (id: string, input: AlterarStatusSessaoInput): Promise<IpcResult<{ sessao: Sessao } & ResultadoFaturamento>> =>
      ipcRenderer.invoke('sessao:alterarStatus', id, input),
    remarcar: (id: string, input: RemarcarSessaoInput): Promise<IpcResult<{ origem: Sessao; destino: Sessao }>> =>
      ipcRenderer.invoke('sessao:remarcar', id, input),
    sobreposicao: (inicioUtc: string, duracaoMin: number, excludingId?: string): Promise<IpcResult<{ colisoes: SessaoComPaciente[] }>> =>
      ipcRenderer.invoke('sessao:sobreposicao', inicioUtc, duracaoMin, excludingId)
  },
  contrato: {
    vigente: (pacienteId: string, data: string): Promise<IpcResult<{ contrato: ContratoPreco | null }>> =>
      ipcRenderer.invoke('contrato:vigente', pacienteId, data),
    historico: (pacienteId: string): Promise<IpcResult<{ contratos: ContratoPreco[] }>> =>
      ipcRenderer.invoke('contrato:historico', pacienteId),
    reajustar: (
      pacienteId: string,
      input: ContratoPrecoInput
    ): Promise<IpcResult<{ contrato: ContratoPreco; lancamentosNoPeriodoAfetado: number }>> =>
      ipcRenderer.invoke('contrato:reajustar', pacienteId, input)
  },
  lancamento: {
    listar: (pacienteId: string): Promise<IpcResult<{ lancamentos: Lancamento[] }>> =>
      ipcRenderer.invoke('lancamento:listar', pacienteId),
    criarAjuste: (pacienteId: string, input: LancamentoAjusteInput): Promise<IpcResult<{ lancamento: Lancamento }>> =>
      ipcRenderer.invoke('lancamento:criarAjuste', pacienteId, input),
    cancelar: (id: string): Promise<IpcResult<{ lancamento: Lancamento }>> => ipcRenderer.invoke('lancamento:cancelar', id),
    listarPendentesTodos: (): Promise<IpcResult<{ lancamentos: LancamentoComPaciente[] }>> =>
      ipcRenderer.invoke('lancamento:listarPendentesTodos')
  },
  pagamento: {
    registrar: (pacienteId: string, input: RegistrarPagamentoInput): Promise<IpcResult<{ pagamento: Pagamento }>> =>
      ipcRenderer.invoke('pagamento:registrar', pacienteId, input),
    listar: (pacienteId: string): Promise<IpcResult<{ pagamentos: Pagamento[] }>> =>
      ipcRenderer.invoke('pagamento:listar', pacienteId),
    marcarReciboEmitido: (id: string, input: MarcarReciboEmitidoInput): Promise<IpcResult<{ pagamento: Pagamento }>> =>
      ipcRenderer.invoke('pagamento:marcarReciboEmitido', id, input)
  },
  relatorio: {
    mensal: (competencia: string): Promise<IpcResult<{ relatorio: RelatorioMensal }>> =>
      ipcRenderer.invoke('relatorio:mensal', competencia),
    exportarCsv: (competencia: string): Promise<IpcResult<{ cancelado: boolean; caminho?: string }>> =>
      ipcRenderer.invoke('relatorio:exportarCsv', competencia)
  },
  anexo: {
    listar: (pacienteId: string, options?: ListarAnexosOptions): Promise<IpcResult<{ anexos: Anexo[] }>> =>
      ipcRenderer.invoke('anexo:listar', pacienteId, options),
    anexarViaDialogo: (
      pacienteId: string,
      input: AnexarViaDialogoInput
    ): Promise<IpcResult<{ cancelado: boolean; anexo?: Anexo }>> =>
      ipcRenderer.invoke('anexo:anexarViaDialogo', pacienteId, input),
    /** Decifrado em memória pelo main — nunca toca disco em claro (D28, I7). */
    ler: (anexoId: string): Promise<IpcResult<{ bytes: Uint8Array; mime: string; nomeOriginal: string }>> =>
      ipcRenderer.invoke('anexo:ler', anexoId),
    salvarCopia: (anexoId: string): Promise<IpcResult<{ cancelado: boolean; caminho?: string }>> =>
      ipcRenderer.invoke('anexo:salvarCopia', anexoId),
    excluir: (id: string): Promise<IpcResult> => ipcRenderer.invoke('anexo:excluir', id),
    restaurar: (id: string): Promise<IpcResult> => ipcRenderer.invoke('anexo:restaurar', id)
  },
  backup: {
    listar: (): Promise<IpcResult<{ backups: BackupListado[] }>> => ipcRenderer.invoke('backup:listar'),
    criar: (): Promise<IpcResult<{ backup: BackupListado }>> => ipcRenderer.invoke('backup:criar'),
    verificar: (pasta: string): Promise<IpcResult<{ resultado: BackupVerificationResult }>> =>
      ipcRenderer.invoke('backup:verificar', pasta),
    ultimaRestauracao: (): Promise<IpcResult<{ registro: RegistroRestauracao | null }>> =>
      ipcRenderer.invoke('backup:ultimaRestauracao'),
    /** O app fecha e reabre sozinho depois de restaurar — esta promise normalmente nunca chega a resolver (o processo morre antes). */
    restaurar: (pasta: string): Promise<IpcResult> => ipcRenderer.invoke('backup:restaurar', pasta)
  }
}

export type PsiTrackApi = typeof api

contextBridge.exposeInMainWorld('psitrack', api)
