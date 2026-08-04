import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const MAX_REGISTROS = 10

export interface ExecucaoBackupAutomatico {
  executadoEm: string // ISO-8601 UTC
  gatilho: 'destrancar' | 'fechar'
  localOk: boolean
  /** `null` = sem destino configurado nesta execução. */
  destinoOk: boolean | null
  erro?: string
}

/** Mais recente primeiro. Mantém só os `MAX_REGISTROS` últimos — histórico de diagnóstico, não registro clínico, não precisa reter para sempre. */
export function registrarExecucao(caminho: string, execucao: ExecucaoBackupAutomatico): void {
  const atuais = lerHistorico(caminho)
  const novos = [execucao, ...atuais].slice(0, MAX_REGISTROS)
  writeFileSync(caminho, JSON.stringify(novos, null, 2), 'utf-8')
}

export function lerHistorico(caminho: string): ExecucaoBackupAutomatico[] {
  if (!existsSync(caminho)) return []
  return JSON.parse(readFileSync(caminho, 'utf-8')) as ExecucaoBackupAutomatico[]
}
