import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../db/connection'
import { runMigrations } from '../db/migrate'
import { pacientes, prontuarioEvolucao } from '../db/schema'
import { createTempDbPath } from '../db/test-support'
import { uuidv7 } from '../db/uuidv7'
import { createKeysFile, writeKeysFile } from '../crypto/envelope'
import { runBackup } from './backup'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'db', 'migrations')

let cleanup: (() => void) | undefined
let openDbs: PsiTrackDatabase[] = []

afterEach(() => {
  for (const db of openDbs) db.$client.close()
  openDbs = []
  cleanup?.()
  cleanup = undefined
})

function seedSourceDb(dek: Buffer, dir: string): PsiTrackDatabase {
  const db = openDatabase({ filePath: join(dir, 'source.db'), dek })
  openDbs.push(db)
  runMigrations(db, MIGRATIONS_FOLDER)

  const pacienteId = uuidv7()
  db.insert(pacientes)
    .values({ id: pacienteId, nome: 'Paciente Teste', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .run()
  db.insert(prontuarioEvolucao)
    .values({ id: uuidv7(), pacienteId, conteudo: 'evolução 1', createdAt: new Date().toISOString() })
    .run()
  db.insert(prontuarioEvolucao)
    .values({ id: uuidv7(), pacienteId, conteudo: 'evolução 2', createdAt: new Date().toISOString() })
    .run()

  return db
}

describe('runBackup', () => {
  it('ciclo backup -> reabrir o snapshot preserva contagens de todas as tabelas', async () => {
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)
    const db = seedSourceDb(dek, temp.dir)

    const { keysFile } = await createKeysFile('senha-teste')
    const keysFilePath = join(temp.dir, 'keys.json')
    writeKeysFile(keysFilePath, keysFile)

    const snapshotPath = join(temp.dir, 'backup.db')
    const manifest = runBackup({
      db,
      dek,
      snapshotPath,
      keysFilePath,
      keysFileDestPath: join(temp.dir, 'backup-keys.json'),
      manifestPath: join(temp.dir, 'manifest.json')
    })

    expect(manifest.verification.ok).toBe(true)
    expect(manifest.verification.integrityCheck).toBe('ok')
    expect(manifest.verification.cipherIntegrityCheckOk).toBe(true)
    expect(manifest.verification.rowCountsMatchSource).toBe(true)
    expect(manifest.schemaVersion).toBe(2) // duas migrations em electron/main/db/migrations

    const restored = openDatabase({ filePath: snapshotPath, dek })
    openDbs.push(restored)
    expect(restored.select().from(pacientes).all()).toHaveLength(1)
    expect(restored.select().from(prontuarioEvolucao).all()).toHaveLength(2)
  })

  it('copia o keys.json atual junto do snapshot', async () => {
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)
    const db = seedSourceDb(dek, temp.dir)

    const { keysFile } = await createKeysFile('senha-teste')
    const keysFilePath = join(temp.dir, 'keys.json')
    writeKeysFile(keysFilePath, keysFile)
    const keysFileDestPath = join(temp.dir, 'backup-keys.json')

    runBackup({
      db,
      dek,
      snapshotPath: join(temp.dir, 'backup.db'),
      keysFilePath,
      keysFileDestPath,
      manifestPath: join(temp.dir, 'manifest.json')
    })

    expect(readFileSync(keysFileDestPath, 'utf-8')).toBe(readFileSync(keysFilePath, 'utf-8'))
  })

  it('não deixa o .tmp intermediário depois de um backup bem-sucedido', async () => {
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)
    const db = seedSourceDb(dek, temp.dir)

    const { keysFile } = await createKeysFile('senha-teste')
    const keysFilePath = join(temp.dir, 'keys.json')
    writeKeysFile(keysFilePath, keysFile)
    const snapshotPath = join(temp.dir, 'backup.db')

    runBackup({
      db,
      dek,
      snapshotPath,
      keysFilePath,
      keysFileDestPath: join(temp.dir, 'backup-keys.json'),
      manifestPath: join(temp.dir, 'manifest.json')
    })

    expect(existsSync(`${snapshotPath}.tmp`)).toBe(false)
    expect(existsSync(snapshotPath)).toBe(true)
  })
})
