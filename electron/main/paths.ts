import { app } from 'electron'
import { join } from 'node:path'

/**
 * Único lugar que sabe onde as coisas ficam no disco de verdade. Módulos
 * puros (crypto/db/backup) recebem caminho como parâmetro; só este arquivo
 * (e o main/index.ts) importa `electron` pra calcular o caminho real —
 * mesmo padrão do resto do projeto, documentado no HANDOFF.md.
 */
export function getDbPath(): string {
  return join(app.getPath('userData'), 'psitrack.db')
}

export function getKeysFilePath(): string {
  return join(app.getPath('userData'), 'keys.json')
}

/**
 * As migrations (.sql + meta/) não são código JS, então o bundler do
 * electron-vite não as enxerga — no app empacotado elas são copiadas à
 * parte via `extraResources` (electron-builder.yml) pra fora do asar, em
 * `resources/migrations`. Em dev, o caminho fonte mesmo já serve.
 */
export function getMigrationsFolder(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'migrations')
    : join(__dirname, '../../electron/main/db/migrations')
}
