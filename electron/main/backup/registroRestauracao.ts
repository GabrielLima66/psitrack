import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export interface RegistroRestauracao {
  restauradoEm: string // ISO-8601 UTC
  pastaOrigem: string
}

function caminhoRegistro(backupDir: string): string {
  return join(backupDir, 'last-restore.json')
}

/**
 * Arquivo simples, não linha de banco — gravar isso no banco que acabou de
 * ser trocado pela restauração seria circular.
 */
export function gravarUltimaRestauracao(backupDir: string, registro: RegistroRestauracao): void {
  writeFileSync(caminhoRegistro(backupDir), JSON.stringify(registro, null, 2), 'utf-8')
}

export function lerUltimaRestauracao(backupDir: string): RegistroRestauracao | null {
  const caminho = caminhoRegistro(backupDir)
  if (!existsSync(caminho)) return null
  return JSON.parse(readFileSync(caminho, 'utf-8')) as RegistroRestauracao
}
