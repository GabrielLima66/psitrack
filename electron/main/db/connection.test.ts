import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3-multiple-ciphers'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from './connection'
import { runMigrations } from './migrate'
import { pacientes } from './schema'
import { createTempDbPath } from './test-support'
import { uuidv7 } from './uuidv7'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), 'migrations')
const MARKER = 'ZZMARCADORTESTE'

let currentCleanup: (() => void) | undefined

afterEach(() => {
  currentCleanup?.()
  currentCleanup = undefined
})

describe('openDatabase', () => {
  it('a chave certa abre e permite migrar/consultar', () => {
    const { filePath, cleanup } = createTempDbPath()
    currentCleanup = cleanup
    const dek = randomBytes(32)

    const db = openDatabase({ filePath, dek })
    runMigrations(db, MIGRATIONS_FOLDER)
    db.insert(pacientes)
      .values({
        id: uuidv7(),
        nome: 'Teste',
        nomeBusca: 'teste',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .run()

    expect(db.select().from(pacientes).all()).toHaveLength(1)
    db.$client.close()
  })

  it('chave errada não abre o banco', () => {
    const { filePath, cleanup } = createTempDbPath()
    currentCleanup = cleanup
    const dek = randomBytes(32)

    const db = openDatabase({ filePath, dek })
    runMigrations(db, MIGRATIONS_FOLDER)
    db.$client.close()

    expect(() => openDatabase({ filePath, dek: randomBytes(32) })).toThrow()
  })

  it('abrir sem PRAGMA key nenhum falha (prova que o arquivo está mesmo cifrado)', () => {
    const { filePath, cleanup } = createTempDbPath()
    currentCleanup = cleanup
    const dek = randomBytes(32)

    const db = openDatabase({ filePath, dek })
    runMigrations(db, MIGRATIONS_FOLDER)
    db.$client.close()

    const raw = new Database(filePath)
    expect(() => raw.prepare('SELECT count(*) FROM sqlite_master').get()).toThrow()
    raw.close()
  })

  it('marcador gravado nunca aparece em claro nos bytes crus do arquivo', () => {
    const { filePath, cleanup } = createTempDbPath()
    currentCleanup = cleanup
    const dek = randomBytes(32)

    const db = openDatabase({ filePath, dek })
    runMigrations(db, MIGRATIONS_FOLDER)
    db.insert(pacientes)
      .values({
        id: uuidv7(),
        nome: MARKER,
        nomeBusca: MARKER.toLowerCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .run()
    db.$client.close()

    const rawBytes = readFileSync(filePath)
    expect(rawBytes.includes(MARKER)).toBe(false)
  })
})
