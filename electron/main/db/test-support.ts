import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { uuidv7 } from './uuidv7'

/**
 * Só usado pelos *.test.ts deste diretório. Cria um diretório temp isolado
 * por teste — no Windows um arquivo `.db` com conexão aberta não pode ser
 * apagado (EBUSY), então quem chama `cleanup` precisa ter fechado a conexão
 * antes.
 */
export function createTempDbPath(): { dir: string; filePath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'psitrack-test-'))
  const filePath = join(dir, `${uuidv7()}.db`)
  return {
    dir,
    filePath,
    cleanup: () => {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  }
}
