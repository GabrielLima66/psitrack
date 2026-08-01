import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createKeysFile, writeKeysFile } from '../crypto/envelope'
import { openDatabase, type PsiTrackDatabase } from '../db/connection'
import { runMigrations } from '../db/migrate'
import { pacientes } from '../db/schema'
import { createTempDbPath } from '../db/test-support'
import { uuidv7 } from '../db/uuidv7'
import { runBackup } from './backup'
import type { BackupManifest } from './manifest'
import { assertRestorable, restoreBackup } from './restore'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'db', 'migrations')

let cleanup: (() => void) | undefined
let openDbs: PsiTrackDatabase[] = []

afterEach(() => {
  for (const db of openDbs) db.$client.close()
  openDbs = []
  cleanup?.()
  cleanup = undefined
})

function baseManifest(schemaVersion: number): BackupManifest {
  return {
    createdAt: new Date().toISOString(),
    schemaVersion,
    verification: {
      ok: true,
      integrityCheck: 'ok',
      cipherIntegrityCheckOk: true,
      rowCounts: {},
      rowCountsMatchSource: true
    }
  }
}

describe('assertRestorable', () => {
  it('permite restaurar backup de versão igual ou mais antiga que o app atual', () => {
    expect(() => assertRestorable(baseManifest(2), MIGRATIONS_FOLDER)).not.toThrow()
    expect(() => assertRestorable(baseManifest(1), MIGRATIONS_FOLDER)).not.toThrow()
  })

  it('bloqueia restaurar backup de versão mais nova que o app atual entende', () => {
    expect(() => assertRestorable(baseManifest(99), MIGRATIONS_FOLDER)).toThrow(/vers.o mais nova/i)
  })
})

describe('restoreBackup', () => {
  it('ciclo completo backup -> restore preserva os dados no destino restaurado', async () => {
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)

    const source = openDatabase({ filePath: join(temp.dir, 'source.db'), dek })
    openDbs.push(source)
    runMigrations(source, MIGRATIONS_FOLDER)
    source.insert(pacientes)
      .values({
        id: uuidv7(),
        nome: 'Paciente X',
        nomeBusca: 'paciente x',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .run()

    const { keysFile } = await createKeysFile('senha-teste')
    const keysFilePath = join(temp.dir, 'keys.json')
    writeKeysFile(keysFilePath, keysFile)

    const snapshotPath = join(temp.dir, 'backup.db')
    const manifest = runBackup({
      db: source,
      dek,
      snapshotPath,
      keysFilePath,
      keysFileDestPath: join(temp.dir, 'backup-keys.json'),
      manifestPath: join(temp.dir, 'manifest.json')
    })

    const targetDbPath = join(temp.dir, 'restored.db')
    const targetKeysFilePath = join(temp.dir, 'restored-keys.json')
    restoreBackup({
      manifest,
      snapshotPath,
      keysFilePath,
      currentMigrationsFolder: MIGRATIONS_FOLDER,
      targetDbPath,
      targetKeysFilePath
    })

    const restored = openDatabase({ filePath: targetDbPath, dek })
    openDbs.push(restored)
    const rows = restored.select().from(pacientes).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.nome).toBe('Paciente X')
  })

  it('não copia nada se o gate de versão bloquear', () => {
    const temp = createTempDbPath()
    cleanup = temp.cleanup

    expect(() =>
      restoreBackup({
        manifest: baseManifest(99),
        snapshotPath: join(temp.dir, 'nao-existe.db'),
        keysFilePath: join(temp.dir, 'nao-existe-keys.json'),
        currentMigrationsFolder: MIGRATIONS_FOLDER,
        targetDbPath: join(temp.dir, 'destino.db'),
        targetKeysFilePath: join(temp.dir, 'destino-keys.json')
      })
    ).toThrow(/vers.o mais nova/i)
  })
})
