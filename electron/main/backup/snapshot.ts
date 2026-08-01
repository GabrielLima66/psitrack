import { existsSync, renameSync, rmSync } from 'node:fs'
import type { PsiTrackDatabase } from '../db/connection'

/**
 * `VACUUM INTO` já produz um arquivo cifrado com a mesma chave da conexão
 * de origem (CLAUDE.md: "sai já cifrado e consistente com o banco em uso").
 * Escreve em `.tmp` e faz rename atômico — nunca escreve direto no destino
 * final, pra nunca deixar um snapshot pela metade com nome de um bom.
 */
export function createSnapshot(db: PsiTrackDatabase, destPath: string): void {
  const tmpPath = `${destPath}.tmp`
  if (existsSync(tmpPath)) {
    rmSync(tmpPath) // sobra de uma tentativa anterior interrompida
  }
  // VACUUM INTO falha se o arquivo de destino já existir — por isso sempre
  // via .tmp novo, nunca sobrescrevendo destPath diretamente.
  db.$client.prepare('VACUUM INTO ?').run(tmpPath)
  renameSync(tmpPath, destPath)
}
