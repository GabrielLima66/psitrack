import { and, asc, eq, gte, isNull, lt } from 'drizzle-orm'
import { z } from 'zod'
import type { PsiTrackDatabase } from '../connection'
import { calcularOcorrencias } from '../materializacao'
import { pacientes, recorrencia, sessao } from '../schema'
import { localParaUtc, utcParaDataLocal } from '../timezone'
import { uuidv7 } from '../uuidv7'
import { dataSchema, encerrarRecorrencia, type Recorrencia } from './recorrencia'

const MODALIDADE_VALUES = ['presencial', 'online'] as const
const STATUS_VALUES = [
  'agendada',
  'realizada',
  'remarcada',
  'cancelada_profissional',
  'falta_sem_aviso',
  'falta_com_aviso'
] as const

const horaLocalSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida — use HH:MM.')

export const criarSessaoAvulsaSchema = z.object({
  pacienteId: z.string().min(1),
  dataLocal: dataSchema,
  horaLocal: horaLocalSchema,
  duracaoMin: z.number().int().positive().default(50),
  modalidade: z.enum(MODALIDADE_VALUES),
  observacao: z.string().trim().min(1).nullish()
})
export type CriarSessaoAvulsaInput = z.input<typeof criarSessaoAvulsaSchema>

export const alterarStatusSessaoSchema = z.object({
  status: z.enum(STATUS_VALUES),
  motivo: z.string().trim().min(1).nullish(),
  avisadaEm: z.iso.datetime().nullish()
})
export type AlterarStatusSessaoInput = z.infer<typeof alterarStatusSessaoSchema>

export const remarcarSessaoSchema = z.object({
  dataLocal: dataSchema,
  horaLocal: horaLocalSchema
})
export type RemarcarSessaoInput = z.infer<typeof remarcarSessaoSchema>

export type Sessao = typeof sessao.$inferSelect
export type SessaoComPaciente = Sessao & { pacienteNome: string }

const HORIZONTE_SEMANAS = 12

export function obterSessaoOuFalhar(db: PsiTrackDatabase, id: string): Sessao {
  const row = db.select().from(sessao).where(eq(sessao.id, id)).get()
  if (!row) throw new Error('Sessão não encontrada.')
  return row
}

function inserirSessao(
  db: PsiTrackDatabase,
  campos: {
    pacienteId: string
    recorrenciaId: string | null
    inicioUtc: string
    duracaoMin: number
    modalidade: 'presencial' | 'online'
    observacao?: string | null
  }
): Sessao {
  const now = new Date().toISOString()
  const id = uuidv7()
  db.insert(sessao)
    .values({
      id,
      pacienteId: campos.pacienteId,
      recorrenciaId: campos.recorrenciaId,
      inicioUtc: campos.inicioUtc,
      duracaoMin: campos.duracaoMin,
      modalidade: campos.modalidade,
      observacao: campos.observacao ?? null,
      createdAt: now,
      updatedAt: now
    })
    .run()
  return obterSessaoOuFalhar(db, id)
}

export function criarSessaoAvulsa(db: PsiTrackDatabase, input: CriarSessaoAvulsaInput): Sessao {
  const parsed = criarSessaoAvulsaSchema.parse(input)
  return inserirSessao(db, {
    pacienteId: parsed.pacienteId,
    recorrenciaId: null,
    inicioUtc: localParaUtc(parsed.dataLocal, parsed.horaLocal),
    duracaoMin: parsed.duracaoMin,
    modalidade: parsed.modalidade,
    observacao: parsed.observacao
  })
}

/**
 * Estende o horizonte materializado de UMA recorrência até `hoje + 12
 * semanas`, sem duplicar (D13): parte do dia seguinte à última ocorrência já
 * gravada (ou de `vigenciaInicio`, se nunca materializou nada). Devolve
 * quantas linhas novas foram inseridas.
 */
export function materializarRecorrencia(db: PsiTrackDatabase, rec: Recorrencia, hojeLocal: string): number {
  const ultima = db
    .select({ inicioUtc: sessao.inicioUtc })
    .from(sessao)
    .where(and(eq(sessao.recorrenciaId, rec.id), isNull(sessao.deletedAt)))
    .orderBy(asc(sessao.inicioUtc))
    .all()
    .at(-1)

  // Nunca materializa pra trás: numa recorrência nova, o início da janela é
  // hoje (ou o começo da vigência, se ela só começar no futuro) — nunca
  // `vigenciaInicio` sozinho, senão uma recorrência com vigência antiga que
  // ainda não tinha sido materializada backfillaria ocorrências passadas
  // como se fossem `agendada`.
  const horizonteInicio = ultima ? somarUmDia(utcParaDataLocal(ultima.inicioUtc)) : maiorData(hojeLocal, rec.vigenciaInicio)
  const horizonteFim = somarDiasData(hojeLocal, HORIZONTE_SEMANAS * 7)

  const ocorrencias = calcularOcorrencias(
    {
      diaSemana: rec.diaSemana,
      horaLocal: rec.horaLocal,
      duracaoMin: rec.duracaoMin,
      modalidade: rec.modalidade,
      vigenciaInicio: rec.vigenciaInicio,
      vigenciaFim: rec.vigenciaFim
    },
    horizonteInicio,
    horizonteFim
  )

  for (const ocorrencia of ocorrencias) {
    inserirSessao(db, {
      pacienteId: rec.pacienteId,
      recorrenciaId: rec.id,
      inicioUtc: ocorrencia.inicioUtc,
      duracaoMin: ocorrencia.duracaoMin,
      modalidade: ocorrencia.modalidade
    })
  }
  return ocorrencias.length
}

function somarUmDia(dataYMD: string): string {
  return somarDiasData(dataYMD, 1)
}

function maiorData(a: string, b: string): string {
  return a > b ? a : b
}

function somarDiasData(dataYMD: string, dias: number): string {
  const [ano, mes, dia] = dataYMD.split('-').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10)
}

/** Chamado na abertura do cofre (D13: "materialização de 12 semanas na abertura do app"). */
export function materializarTodasRecorrencias(db: PsiTrackDatabase, hojeLocal = utcParaDataLocal(new Date().toISOString())): number {
  const ativas = db.select().from(recorrencia).where(isNull(recorrencia.deletedAt)).all()
  let total = 0
  for (const rec of ativas) {
    total += materializarRecorrencia(db, rec, hojeLocal)
  }
  return total
}

/**
 * Encerra a série (recorrência) e cancela — soft delete — as ocorrências
 * futuras `agendada` que já tinham sido materializadas a partir dela.
 * Sessão `realizada`/falta/etc nunca é apagada, só a placeholder que ainda
 * não aconteceu (critério de aceite da Etapa 11).
 */
export function encerrarSerie(db: PsiTrackDatabase, recorrenciaId: string, dataFim: string): Recorrencia {
  const atualizada = encerrarRecorrencia(db, recorrenciaId, dataFim)
  const corteUtc = localParaUtc(dataFim, '00:00')
  const now = new Date().toISOString()

  db.update(sessao)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(eq(sessao.recorrenciaId, recorrenciaId), eq(sessao.status, 'agendada'), gte(sessao.inicioUtc, corteUtc), isNull(sessao.deletedAt))
    )
    .run()

  return atualizada
}

/** Agenda inteira do consultório — não filtra por paciente (D-visão semanal/diária é do dia a dia, não da ficha). */
export function listarSessoesPeriodo(db: PsiTrackDatabase, inicioUtc: string, fimUtc: string): SessaoComPaciente[] {
  return db
    .select({
      id: sessao.id,
      pacienteId: sessao.pacienteId,
      recorrenciaId: sessao.recorrenciaId,
      inicioUtc: sessao.inicioUtc,
      duracaoMin: sessao.duracaoMin,
      modalidade: sessao.modalidade,
      status: sessao.status,
      statusAlteradoEm: sessao.statusAlteradoEm,
      avisadaEm: sessao.avisadaEm,
      motivo: sessao.motivo,
      remarcadaParaId: sessao.remarcadaParaId,
      observacao: sessao.observacao,
      createdAt: sessao.createdAt,
      updatedAt: sessao.updatedAt,
      deletedAt: sessao.deletedAt,
      pacienteNome: pacientes.nome
    })
    .from(sessao)
    .innerJoin(pacientes, eq(sessao.pacienteId, pacientes.id))
    .where(and(isNull(sessao.deletedAt), gte(sessao.inicioUtc, inicioUtc), lt(sessao.inicioUtc, fimUtc)))
    .orderBy(asc(sessao.inicioUtc))
    .all()
}

export function alterarStatusSessao(db: PsiTrackDatabase, id: string, input: AlterarStatusSessaoInput): Sessao {
  obterSessaoOuFalhar(db, id)
  const parsed = alterarStatusSessaoSchema.parse(input)
  const now = new Date().toISOString()

  db.update(sessao)
    .set({
      status: parsed.status,
      motivo: parsed.motivo ?? null,
      avisadaEm: parsed.avisadaEm ?? null,
      statusAlteradoEm: now,
      updatedAt: now
    })
    .where(eq(sessao.id, id))
    .run()

  return obterSessaoOuFalhar(db, id)
}

/**
 * Encaixe (D22): a origem nunca cobra — quem cobra é a sessão de destino.
 * Cria a sessão nova avulsa (fora de qualquer recorrência) e liga via
 * `remarcadaParaId`; a origem vira `remarcada`.
 */
export function remarcarSessao(db: PsiTrackDatabase, origemId: string, input: RemarcarSessaoInput): { origem: Sessao; destino: Sessao } {
  const origem = obterSessaoOuFalhar(db, origemId)
  const parsed = remarcarSessaoSchema.parse(input)

  const destino = inserirSessao(db, {
    pacienteId: origem.pacienteId,
    recorrenciaId: null,
    inicioUtc: localParaUtc(parsed.dataLocal, parsed.horaLocal),
    duracaoMin: origem.duracaoMin,
    modalidade: origem.modalidade
  })

  const now = new Date().toISOString()
  db.update(sessao)
    .set({ status: 'remarcada', remarcadaParaId: destino.id, statusAlteradoEm: now, updatedAt: now })
    .where(eq(sessao.id, origemId))
    .run()

  return { origem: obterSessaoOuFalhar(db, origemId), destino }
}

const STATUS_OCUPAM_HORARIO = ['agendada', 'realizada', 'falta_sem_aviso', 'falta_com_aviso'] as const

/**
 * Aviso, nunca bloqueio (escopo da Etapa 11) — devolve o que colide, quem
 * chama decide se avisa e deixa a usuária seguir mesmo assim.
 */
export function sobreposicaoHorario(
  db: PsiTrackDatabase,
  inicioUtc: string,
  duracaoMin: number,
  excludingId?: string
): SessaoComPaciente[] {
  const fimUtc = new Date(new Date(inicioUtc).getTime() + duracaoMin * 60_000).toISOString()
  // Janela de busca generosa (dia inteiro ao redor) — a comparação exata de sobreposição é feita em JS abaixo.
  const janelaInicio = new Date(new Date(inicioUtc).getTime() - 24 * 60 * 60_000).toISOString()
  const janelaFim = new Date(new Date(inicioUtc).getTime() + 24 * 60 * 60_000).toISOString()

  const candidatas = listarSessoesPeriodo(db, janelaInicio, janelaFim).filter(
    (s) => s.id !== excludingId && (STATUS_OCUPAM_HORARIO as readonly string[]).includes(s.status)
  )

  return candidatas.filter((s) => {
    const outroFim = new Date(new Date(s.inicioUtc).getTime() + s.duracaoMin * 60_000).toISOString()
    return s.inicioUtc < fimUtc && outroFim > inicioUtc
  })
}
