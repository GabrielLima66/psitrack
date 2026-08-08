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

const FORMATADOR_MES_ANO_SP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  month: '2-digit',
  year: 'numeric'
})

export function formatarMesAnoBr(isoUtc: string): string {
  return FORMATADOR_MES_ANO_SP.format(new Date(isoUtc))
}

const FORMATADOR_DATA_CURTA_SP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
})

/** Igual a `formatarDataBr`, mas pra timestamp UTC de verdade (ex.: `createdAt`) — não confundir com datas locais puras. */
export function formatarDataCurtaUtc(isoUtc: string): string {
  return FORMATADOR_DATA_CURTA_SP.format(new Date(isoUtc))
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

const MESES_ABREV = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

/** 'YYYY-MM-DD' → 'MAR 2026' — rótulo de grupo de mês na timeline de evolução. String pura, mesma razão de formatarDataBr. */
export function formatarMesAnoAbrevDeData(isoDate: string): string {
  const [ano, mes] = isoDate.split('-')
  return `${MESES_ABREV[Number(mes) - 1]} ${ano}`
}

const TIPO_EVOLUCAO_LABELS: Record<string, string> = {
  sessao: 'Sessão',
  contato: 'Contato',
  administrativo: 'Administrativo'
}

export function formatarTipoEvolucao(tipo: string): string {
  return TIPO_EVOLUCAO_LABELS[tipo] ?? tipo
}

/** Centavos → 'R$ 150,00' — nunca formatar float, o valor já chega inteiro (CLAUDE.md invariante de dado #3). */
export function formatarCentavos(valorCentavos: number): string {
  return (valorCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const MODALIDADE_CONTRATO_LABELS: Record<string, string> = {
  avulso: 'Avulso (por sessão)',
  mensal: 'Mensal (por competência)',
  encerrado: 'Encerrado'
}

export function formatarModalidadeContrato(modalidade: string): string {
  return MODALIDADE_CONTRATO_LABELS[modalidade] ?? modalidade
}

const POLITICA_FALTA_LABELS: Record<string, string> = {
  cobra_sempre: 'Cobra sempre',
  cobra_sem_aviso: 'Cobra só sem aviso prévio',
  nunca_cobra: 'Nunca cobra falta'
}

export function formatarPoliticaFalta(politica: string): string {
  return POLITICA_FALTA_LABELS[politica] ?? politica
}

const TIPO_LANCAMENTO_LABELS: Record<string, string> = {
  sessao: 'Sessão',
  falta: 'Falta',
  ajuste: 'Ajuste',
  desconto: 'Desconto'
}

export function formatarTipoLancamento(tipo: string): string {
  return TIPO_LANCAMENTO_LABELS[tipo] ?? tipo
}

const STATUS_LANCAMENTO_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  cancelado: 'Cancelado'
}

export function formatarStatusLancamento(status: string): string {
  return STATUS_LANCAMENTO_LABELS[status] ?? status
}

/** 'YYYY-MM' → 'MM/AAAA' — manipulação de string, mesma razão de formatarDataBr. */
export function formatarCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-')
  return `${mes}/${ano}`
}

const MEIO_PAGAMENTO_LABELS: Record<string, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  cartao: 'Cartão',
  outro: 'Outro'
}

export function formatarMeioPagamento(meio: string): string {
  return MEIO_PAGAMENTO_LABELS[meio] ?? meio
}

/** Sempre a partir de bytes inteiros (nunca fração) — não confundir com dinheiro em centavos, essa regra é só do CLAUDE.md invariante #3. */
export function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
}

const CLASSIFICACAO_ANEXO_LABELS: Record<string, string> = {
  prontuario: 'Prontuário',
  privado: 'Privado'
}

export function formatarClassificacaoAnexo(classificacao: string): string {
  return CLASSIFICACAO_ANEXO_LABELS[classificacao] ?? classificacao
}
