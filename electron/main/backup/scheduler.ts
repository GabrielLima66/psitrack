import type { PsiTrackDatabase } from '../db/connection'
import { criarBackupComDestino } from './destinos'
import { listarBackups } from './gerenciador'
import { registrarExecucao, type ExecucaoBackupAutomatico } from './historico'

const HORAS_MINIMAS_ENTRE_BACKUPS_AUTOMATICOS = 24

/**
 * Flag em memória, só pra fechar a corrida entre "acabei de decidir agendar
 * um backup automático" e "o auto-lock zera a DEK antes dele rodar de
 * verdade" (Etapa 21) — não é sobre interromper um backup já em execução
 * (I/O síncrono: uma vez começado, ninguém mais roda até ele terminar).
 * Consultada pelo auto-lock em `index.ts`, que nunca zera a DEK enquanto
 * `true`.
 */
let emAndamento = false

export function backupAutomaticoEmAndamento(): boolean {
  return emAndamento
}

/** Exportados só pra teste simular "já em andamento" de fora — produção nunca chama estes dois soltos, sempre via `executarComExclusao`. */
export function marcarBackupAutomaticoIniciado(): void {
  emAndamento = true
}

export function marcarBackupAutomaticoConcluido(): void {
  emAndamento = false
}

/** Marca ANTES de qualquer I/O e desmarca sempre no fim (sucesso ou erro) — a própria chamada garante o par, em vez de exigir que cada call site lembre do `try/finally`. */
function executarComExclusao<T>(fn: () => T): T {
  marcarBackupAutomaticoIniciado()
  try {
    return fn()
  } finally {
    marcarBackupAutomaticoConcluido()
  }
}

/**
 * `total_changes()` do SQLite conta desde que a CONEXÃO abriu — o que inclui
 * a migração automática e a materialização de recorrências que rodam em
 * todo unlock (`openAndMigrate` em `ipc/vault.ts`), não só o que a usuária
 * de fato editou. Por isso a baseline é capturada uma vez, logo depois
 * desses passos automáticos terminarem (`definirBaselineEscritas`, chamada
 * por `ipc/vault.ts`) — `houveEscritaNaSessao` compara contra ela, não
 * contra zero, senão ia dar "houve escrita" quase sempre, mesmo sem a
 * usuária ter tocado em nada.
 */
let baselineTotalChanges = 0

export function definirBaselineEscritas(valor: number): void {
  baselineTotalChanges = valor
}

/**
 * "Destrancar duas vezes no mesmo dia dispara um backup só" / "após 48h
 * dispara imediatamente" (D40): sem nenhum backup local ainda (qualquer
 * origem — manual, automático ou pré-restore, todos contam), ou o mais
 * recente já passou de 24h. Não precisa de contador/estado extra — o
 * próprio `createdAt` do backup mais recente já é a fonte da verdade.
 */
export function deveExecutarBackupAutomatico(backupDir: string): boolean {
  const backups = listarBackups(backupDir)
  if (backups.length === 0) return true

  const maisRecente = backups.reduce((a, b) => (b.manifest.createdAt > a.manifest.createdAt ? b : a))
  const horasDesde = (Date.now() - new Date(maisRecente.manifest.createdAt).getTime()) / (60 * 60 * 1000)
  return horasDesde > HORAS_MINIMAS_ENTRE_BACKUPS_AUTOMATICOS
}

/**
 * `total_changes()` é nativo do SQLite: conta linhas inseridas/alteradas/
 * apagadas desde que ESTA conexão abriu. Detecta "houve escrita na sessão"
 * sem instrumentar cada função de escrita do app uma por uma — mas conta
 * TAMBÉM a migração automática e a materialização de recorrências que
 * rodam em todo unlock, não só o que a usuária editou. Por isso compara
 * contra uma baseline (capturada uma vez, logo depois desses passos
 * automáticos — ver `definirBaselineEscritas` acima), nunca contra zero.
 */
export function totalChangesAtual(db: PsiTrackDatabase): number {
  const linha = db.$client.prepare('SELECT total_changes() as contagem').get() as { contagem: number }
  return linha.contagem
}

export function houveEscritaNaSessao(db: PsiTrackDatabase, baselineTotalChanges: number): boolean {
  return totalChangesAtual(db) > baselineTotalChanges
}

export interface DispararBackupAutomaticoOptions {
  db: PsiTrackDatabase
  dek: Buffer
  backupDir: string
  anexosDir: string
  keysFilePath: string
  configPath: string
  historicoPath: string
  gatilho: 'destrancar' | 'fechar'
  /** `true` só faz sentido pro gatilho 'fechar' — o de 'destrancar' pode estar checando dias sem nenhuma sessão aberta ainda. */
  exigirEscritaNaSessao: boolean
  /** Quem chama decide o que fazer com o resultado (mandar evento IPC, etc.) — mantém este módulo sem import de `electron`, testável. */
  onResultado: (execucao: ExecucaoBackupAutomatico) => void
}

/**
 * Reaproveita `criarBackupComDestino` (Etapa 19) sem alteração nenhuma.
 * Devolve `false` sem fazer nada se: já há um backup automático em
 * andamento, a política de "no máximo um por dia" ainda não permite, ou
 * (pro gatilho 'fechar') não houve escrita nesta sessão. O corpo roda dentro
 * de `executarComExclusao`, que já fecha a corrida com o auto-lock.
 */
export function dispararBackupAutomaticoSeNecessario(opts: DispararBackupAutomaticoOptions): boolean {
  if (backupAutomaticoEmAndamento()) return false
  if (!deveExecutarBackupAutomatico(opts.backupDir)) return false
  if (opts.exigirEscritaNaSessao && !houveEscritaNaSessao(opts.db, baselineTotalChanges)) return false

  executarComExclusao(() => {
    try {
      const resultado = criarBackupComDestino({
        db: opts.db,
        dek: opts.dek,
        backupDir: opts.backupDir,
        anexosDir: opts.anexosDir,
        keysFilePath: opts.keysFilePath,
        configPath: opts.configPath
      })
      const execucao: ExecucaoBackupAutomatico = {
        executadoEm: new Date().toISOString(),
        gatilho: opts.gatilho,
        localOk: true,
        destinoOk: resultado.destinoOk,
        erro: resultado.destinoOk === false ? resultado.destinoErro : undefined
      }
      registrarExecucao(opts.historicoPath, execucao)
      opts.onResultado(execucao)
    } catch (erro) {
      const execucao: ExecucaoBackupAutomatico = {
        executadoEm: new Date().toISOString(),
        gatilho: opts.gatilho,
        localOk: false,
        destinoOk: null,
        erro: (erro as Error).message
      }
      registrarExecucao(opts.historicoPath, execucao)
      opts.onResultado(execucao)
    }
  })
  return true
}
