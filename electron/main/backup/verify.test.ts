import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../db/connection'
import { runMigrations } from '../db/migrate'
import { createTempDbPath } from '../db/test-support'
import { createSnapshot } from './snapshot'
import { verifySnapshot } from './verify'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'db', 'migrations')

let cleanup: (() => void) | undefined
let db: PsiTrackDatabase | undefined

afterEach(() => {
  db?.$client.close()
  db = undefined
  cleanup?.()
  cleanup = undefined
})

describe('verifySnapshot', () => {
  it('chave errada lança erro em vez de devolver ok:false silencioso', () => {
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)

    db = openDatabase({ filePath: join(temp.dir, 'source.db'), dek })
    runMigrations(db, MIGRATIONS_FOLDER)

    const snapshotPath = join(temp.dir, 'backup.db')
    createSnapshot(db, snapshotPath)

    expect(() => verifySnapshot(snapshotPath, randomBytes(32), {})).toThrow()
  })
})
