import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

/**
 * Cadastro de paciente: identificação, contato e cobrança — nada de conteúdo
 * clínico aqui (SPEC-fase-1.md D1/D2). Idade é sempre derivada de
 * `dataNascimento` em runtime, nunca persistida (menoridade muda sozinha aos
 * 18 se fosse coluna). Timestamps em texto ISO-8601 UTC (CLAUDE.md
 * invariante de dado #4). ID é UUID v7, nunca autoincrement.
 */
export const pacientes = sqliteTable(
  'pacientes',
  {
    id: text('id').primaryKey(),
    nome: text('nome').notNull(),
    nomeSocial: text('nome_social'),
    nomeBusca: text('nome_busca').notNull(), // derivado de nome+nomeSocial, ver normalizarBusca()
    dataNascimento: text('data_nascimento'), // 'YYYY-MM-DD', sem hora nem fuso
    cpf: text('cpf'), // só dígitos, 11 chars — nullable de verdade (menor sem CPF existe)
    telefone: text('telefone'),
    email: text('email'),
    status: text('status').notNull().default('ativo').$type<'ativo' | 'pausado' | 'encerrado'>(),
    motivoEncerramento: text('motivo_encerramento').$type<'alta' | 'abandono' | 'encaminhamento' | 'outro'>(),
    statusAlteradoEm: text('status_alterado_em'),
    origem: text('origem').$type<'indicacao' | 'convenio' | 'redes' | 'outro'>(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (t) => [
    // Único só entre não-deletados: permite recadastro do mesmo CPF após soft delete.
    uniqueIndex('idx_pacientes_cpf')
      .on(t.cpf)
      .where(sql`${t.cpf} is not null and ${t.deletedAt} is null`),
    index('idx_pacientes_busca').on(t.nomeBusca),
    index('idx_pacientes_status').on(t.status, t.deletedAt)
  ]
)

/**
 * Responsável legal — N por paciente (guarda compartilhada é o caso comum).
 * `principal` é o contato preferencial; `pagador` é quem figura no recibo —
 * não são sempre a mesma pessoa (pai paga, mãe leva). Nenhuma trigger:
 * responsável é dado cadastral, edita e apaga à vontade como `pacientes`.
 */
export const pacienteResponsavel = sqliteTable(
  'paciente_responsavel',
  {
    id: text('id').primaryKey(),
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    nome: text('nome').notNull(),
    cpf: text('cpf'),
    parentesco: text('parentesco').notNull().$type<'mae' | 'pai' | 'avo' | 'tutor' | 'outro'>(),
    telefone: text('telefone'),
    email: text('email'),
    principal: integer('principal', { mode: 'boolean' }).notNull().default(false),
    pagador: integer('pagador', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (t) => [index('idx_resp_paciente').on(t.pacienteId, t.deletedAt)]
)

/**
 * Append-only de verdade, garantido por trigger SQLite (migrations
 * 0001/0002), não só por convenção da camada de aplicação. Por isso não tem
 * `updated_at`/`deleted_at`: nada aqui nunca é atualizado nem apagado —
 * correção é `retifica_id` apontando pra linha original.
 * `dataSessao` ≠ `createdAt`: o registro pode ser digitado dias depois do
 * atendimento. Listagem/export ordenam por `dataSessao`; auditoria usa
 * `createdAt`.
 */
export const prontuarioEvolucao = sqliteTable('prontuario_evolucao', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id')
    .notNull()
    .references(() => pacientes.id),
  conteudo: text('conteudo').notNull(),
  retificaId: text('retifica_id').references((): AnySQLiteColumn => prontuarioEvolucao.id),
  dataSessao: text('data_sessao').notNull(), // 'YYYY-MM-DD'
  tipo: text('tipo').notNull().default('sessao').$type<'sessao' | 'contato' | 'administrativo'>(),
  motivoRetificacao: text('motivo_retificacao'), // obrigatório na app quando retificaId != null
  sessaoId: text('sessao_id').references((): AnySQLiteColumn => sessao.id), // preenchido só no insert (SPEC-fase-2.md D17) — tabela é append-only, vínculo retroativo é impossível sem relaxar a trigger
  createdAt: text('created_at').notNull()
})

/**
 * NUNCA entra em export (CLAUDE.md invariante de dado #2) — a assimetria com
 * `prontuario_evolucao` é a feature, não um descuido: sem trigger, edita e
 * apaga à vontade, TEM updated_at/deleted_at (ao contrário da evolução).
 * Não "conserte" isso pra ficar simétrico com prontuario_evolucao.
 */
export const anotacaoPrivada = sqliteTable('anotacao_privada', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id')
    .notNull()
    .references(() => pacientes.id),
  titulo: text('titulo'),
  conteudo: text('conteudo').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at')
})

/**
 * N por paciente — dois ou mais horários fixos na semana é caso normal, não
 * exceção (SPEC-fase-2.md §4.1). `horaLocal` é hora em America/Sao_Paulo,
 * convertida pra UTC só na materialização da `sessao` (D14) — Brasil não
 * tem horário de verão hoje; se voltar, basta regerar o horizonte.
 */
export const recorrencia = sqliteTable('recorrencia', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id')
    .notNull()
    .references(() => pacientes.id),
  diaSemana: integer('dia_semana').notNull(), // 0=dom … 6=sáb
  horaLocal: text('hora_local').notNull(), // 'HH:MM' em America/Sao_Paulo
  duracaoMin: integer('duracao_min').notNull().default(50),
  modalidade: text('modalidade').notNull().$type<'presencial' | 'online'>(),
  vigenciaInicio: text('vigencia_inicio').notNull(), // 'YYYY-MM-DD'
  vigenciaFim: text('vigencia_fim'), // null = ativa
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at')
})

/**
 * Materializada (D13): ocorrência concreta, não regra virtual + exceção.
 * Exceção (falta, cancelamento, encaixe) vira edição desta linha, nunca
 * cálculo em runtime. `observacao` é logística ("pediu pra entrar pelos
 * fundos") — se for clínico, é evolução (mesmo raciocínio do D2 da Fase 1).
 */
export const sessao = sqliteTable(
  'sessao',
  {
    id: text('id').primaryKey(),
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    recorrenciaId: text('recorrencia_id').references(() => recorrencia.id),
    inicioUtc: text('inicio_utc').notNull(), // ISO-8601 UTC
    duracaoMin: integer('duracao_min').notNull(),
    modalidade: text('modalidade').notNull().$type<'presencial' | 'online'>(),
    status: text('status')
      .notNull()
      .default('agendada')
      .$type<'agendada' | 'realizada' | 'remarcada' | 'cancelada_profissional' | 'falta_sem_aviso' | 'falta_com_aviso'>(),
    statusAlteradoEm: text('status_alterado_em'),
    avisadaEm: text('avisada_em'), // pra calcular aviso prévio de falta
    motivo: text('motivo'),
    remarcadaParaId: text('remarcada_para_id').references((): AnySQLiteColumn => sessao.id), // encaixe: aponta pra sessão nova
    observacao: text('observacao'), // logística, NUNCA clínico
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (t) => [
    index('idx_sessao_agenda').on(t.inicioUtc, t.deletedAt),
    index('idx_sessao_paciente').on(t.pacienteId, t.inicioUtc)
  ]
)

/**
 * Só `vigenciaInicio` — sem coluna de fim (D11). O fim é derivado da
 * vigência seguinte na consulta (ver precoVigenteEm), o que elimina por
 * construção sobreposição e buraco de vigência. Reajuste é linha nova;
 * nenhum UPDATE em histórico (I3). Encerrar contrato é linha com
 * `modalidade = 'encerrado'` e `valorCentavos` null (D12).
 */
export const contratoPreco = sqliteTable(
  'contrato_preco',
  {
    id: text('id').primaryKey(),
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    modalidade: text('modalidade').notNull().$type<'avulso' | 'mensal' | 'encerrado'>(),
    valorCentavos: integer('valor_centavos'), // POR SESSÃO. null quando 'encerrado'
    politicaFalta: text('politica_falta')
      .notNull()
      .default('cobra_sem_aviso')
      .$type<'cobra_sempre' | 'cobra_sem_aviso' | 'nunca_cobra'>(),
    avisoMinimoHoras: integer('aviso_minimo_horas').notNull().default(24),
    vigenciaInicio: text('vigencia_inicio').notNull(), // 'YYYY-MM-DD'
    observacao: text('observacao'), // "valor social", "acordo até dez"
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (t) => [index('idx_contrato_vigencia').on(t.pacienteId, t.vigenciaInicio)]
)

/**
 * `sessaoUnico` é a proteção estrutural contra cobrança duplicada (D15/§2.1)
 * — retificar uma evolução não pode gerar um segundo lançamento pra mesma
 * sessão. `competencia` é armazenada, não derivada em consulta: a sessão
 * está em UTC e a virada do mês é local (sessão de 31/01 23:00 local é
 * competência 2025-01, não 2025-02 — ver calcularCompetencia).
 */
export const lancamento = sqliteTable(
  'lancamento',
  {
    id: text('id').primaryKey(),
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    sessaoId: text('sessao_id').references(() => sessao.id), // null em ajuste/desconto
    competencia: text('competencia').notNull(), // 'YYYY-MM' da data LOCAL da sessão
    tipo: text('tipo').notNull().$type<'sessao' | 'falta' | 'ajuste' | 'desconto'>(),
    descricao: text('descricao').notNull(),
    valorCentavos: integer('valor_centavos').notNull(), // pode ser negativo (desconto)
    status: text('status').notNull().default('pendente').$type<'pendente' | 'pago' | 'cancelado'>(),
    pagamentoId: text('pagamento_id').references((): AnySQLiteColumn => pagamento.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (t) => [
    uniqueIndex('idx_lancamento_sessao')
      .on(t.sessaoId)
      .where(sql`${t.sessaoId} is not null and ${t.deletedAt} is null`),
    index('idx_lancamento_pendentes').on(t.pacienteId, t.status, t.competencia)
  ]
)

/**
 * `pagadorNome`/`pagadorCpf` são snapshot, não FK: se o responsável pagador
 * mudar depois, o recibo já emitido continua refletindo quem pagou de
 * verdade. `reciboReferencia` é registro de emissão feita fora do app, não
 * emissão de verdade (D18) — Receita Saúde não tem API de terceiros (I8).
 */
export const pagamento = sqliteTable('pagamento', {
  id: text('id').primaryKey(),
  pacienteId: text('paciente_id')
    .notNull()
    .references(() => pacientes.id),
  valorCentavos: integer('valor_centavos').notNull(),
  data: text('data').notNull(), // 'YYYY-MM-DD' — regime de caixa
  meio: text('meio').notNull().$type<'pix' | 'dinheiro' | 'transferencia' | 'cartao' | 'outro'>(),
  pagadorNome: text('pagador_nome').notNull(),
  pagadorCpf: text('pagador_cpf'),
  reciboEmitidoEm: text('recibo_emitido_em'),
  reciboReferencia: text('recibo_referencia'), // número gerado pela Receita
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at')
})

/**
 * O blob de verdade (`<uuid>.enc`) mora fora do banco, em `{userData}/anexos/`
 * — esta linha é só metadado + as chaves pra abrir o arquivo (SPEC-fase-3.md
 * D25). `nomeOriginal` só existe aqui, nunca no filesystem (I7). `nonce` é da
 * cifragem do CONTEÚDO; `chaveEnvelopada` é a DEK do arquivo (32 bytes,
 * aleatória, única) envelopada pela chave mestra da sessão — sem o banco,
 * o `.enc` sozinho é lixo criptográfico. `sha256Cifrado` é hash do blob
 * (ciphertext+authTag) tal como gravado em disco, pra `verify` de backup
 * conferir sem decifrar nada (D26).
 */
export const anexo = sqliteTable(
  'anexo',
  {
    id: text('id').primaryKey(), // UUID v7 — é também o nome do arquivo em disco
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    evolucaoId: text('evolucao_id').references(() => prontuarioEvolucao.id),
    classificacao: text('classificacao').notNull().$type<'prontuario' | 'privado'>(),
    nomeOriginal: text('nome_original').notNull(),
    mime: text('mime').notNull(),
    tamanhoBytes: integer('tamanho_bytes').notNull(),
    sha256Cifrado: text('sha256_cifrado').notNull(),
    nonce: text('nonce').notNull(), // base64
    chaveEnvelopada: text('chave_envelopada').notNull(), // base64
    descricao: text('descricao'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at')
  },
  (t) => [
    index('idx_anexo_paciente').on(t.pacienteId, t.classificacao, t.deletedAt),
    index('idx_anexo_evolucao').on(t.evolucaoId)
  ]
)
