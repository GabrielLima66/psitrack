import { randomBytes } from 'node:crypto'
import { cpSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../db/connection'
import { runMigrations } from '../db/migrate'
import { createTempDbPath } from '../db/test-support'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'db', 'migrations')

/**
 * Clona a pasta de migrations real e adiciona uma 4ª migration dummy —
 * simula "o app entende uma versão que o banco ainda não tem" sem depender
 * de uma migration 003 real existir ainda.
 */
function criarPastaMigrationsComExtra(): string {
  const dir = mkdtempSync(join(tmpdir(), 'psitrack-migrations-extra-'))
  cpSync(MIGRATIONS_FOLDER, dir, { recursive: true })
  writeFileSync(join(dir, '0003_dummy_test.sql'), 'CREATE TABLE dummy_test (id text primary key);')

  const journalPath = join(dir, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as { entries: unknown[] }
  journal.entries.push({ idx: journal.entries.length, version: '6', when: Date.now(), tag: '0003_dummy_test', breakpoints: true })
  writeFileSync(journalPath, JSON.stringify(journal, null, 2))

  return dir
}

function existeTabela(db: PsiTrackDatabase, nome: string): boolean {
  return (
    db.$client.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(nome) !== undefined
  )
}

let cleanup: (() => void) | undefined
let db: PsiTrackDatabase | undefined

afterEach(() => {
  vi.doUnmock('./snapshot')
  vi.doUnmock('./verify')
  vi.resetModules()
  db?.$client.close()
  db = undefined
  cleanup?.()
  cleanup = undefined
})

describe('migrarComSeguranca', () => {
  it('banco novo não gera snapshot — não há o que proteger', async () => {
    const { migrarComSeguranca } = await import('./pre-migration')
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)

    db = openDatabase({ filePath: temp.filePath, dek })
    migrarComSeguranca({ db, dek, migrationsFolder: MIGRATIONS_FOLDER, backupDir: temp.dir })

    const arquivosDeSnapshot = readdirSync(temp.dir).filter((f) => f.startsWith('pre-migration-'))
    expect(arquivosDeSnapshot).toHaveLength(0)
  })

  it('banco existente com migration pendente gera snapshot verificado antes do DDL', async () => {
    const { migrarComSeguranca } = await import('./pre-migration')
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)

    db = openDatabase({ filePath: temp.filePath, dek })
    runMigrations(db, MIGRATIONS_FOLDER) // leva o banco pra v3 (estado real da Fase 1)
    db.$client.close()

    const pastaComExtra = criarPastaMigrationsComExtra() // "app" entende v4
    db = openDatabase({ filePath: temp.filePath, dek })
    migrarComSeguranca({ db, dek, migrationsFolder: pastaComExtra, backupDir: temp.dir })

    const arquivosDeSnapshot = readdirSync(temp.dir).filter((f) => f.startsWith('pre-migration-v4-') && f.endsWith('.db'))
    expect(arquivosDeSnapshot).toHaveLength(1)
    expect(existeTabela(db, 'dummy_test')).toBe(true) // migration pendente foi mesmo aplicada
  })

  it('verify falhando aborta a migração e deixa o banco original intacto', async () => {
    vi.doMock('./verify', async () => {
      const real = await vi.importActual<typeof import('./verify')>('./verify')
      return {
        ...real,
        verifySnapshot: vi.fn(() => ({
          ok: false,
          integrityCheck: 'erro simulado',
          cipherIntegrityCheckOk: false,
          rowCounts: {},
          rowCountsMatchSource: false
        }))
      }
    })
    const { migrarComSeguranca } = await import('./pre-migration')

    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)

    db = openDatabase({ filePath: temp.filePath, dek })
    runMigrations(db, MIGRATIONS_FOLDER)
    db.$client.close()

    const pastaComExtra = criarPastaMigrationsComExtra()
    db = openDatabase({ filePath: temp.filePath, dek })

    expect(() =>
      migrarComSeguranca({ db: db!, dek, migrationsFolder: pastaComExtra, backupDir: temp.dir })
    ).toThrow(/verificação/i)

    expect(existeTabela(db, 'dummy_test')).toBe(false) // migração pendente nunca rodou
  })

  it('falha do próprio snapshot (ex.: disco cheio) aborta sem deixar banco meio-migrado', async () => {
    vi.doMock('./snapshot', () => ({
      createSnapshot: vi.fn(() => {
        throw new Error('ENOSPC: no space left on device (simulado)')
      })
    }))
    const { migrarComSeguranca } = await import('./pre-migration')

    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)

    db = openDatabase({ filePath: temp.filePath, dek })
    runMigrations(db, MIGRATIONS_FOLDER)
    db.$client.close()

    const pastaComExtra = criarPastaMigrationsComExtra()
    db = openDatabase({ filePath: temp.filePath, dek })

    expect(() =>
      migrarComSeguranca({ db: db!, dek, migrationsFolder: pastaComExtra, backupDir: temp.dir })
    ).toThrow(/ENOSPC/)

    expect(existeTabela(db, 'dummy_test')).toBe(false)
  })
})
