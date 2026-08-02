import { randomBytes } from 'node:crypto'
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salvarAnexo } from '../anexos/anexoStore'
import { openDatabase, type PsiTrackDatabase } from '../db/connection'
import { readSchemaVersion, runMigrations } from '../db/migrate'
import { criarPaciente } from '../db/repositories/pacientes'
import { createTempDbPath } from '../db/test-support'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'db', 'migrations')
const VERSAO_REAL = readSchemaVersion(MIGRATIONS_FOLDER)
const VERSAO_COM_EXTRA = VERSAO_REAL + 1

/**
 * Clona a pasta de migrations real e adiciona mais uma migration dummy —
 * simula "o app entende uma versão que o banco ainda não tem" sem depender
 * de qual seja a migration mais nova de verdade (esse número muda a cada fase).
 */
function criarPastaMigrationsComExtra(): string {
  const dir = mkdtempSync(join(tmpdir(), 'psitrack-migrations-extra-'))
  cpSync(MIGRATIONS_FOLDER, dir, { recursive: true })
  const tag = `${String(VERSAO_REAL).padStart(4, '0')}_dummy_test`
  writeFileSync(join(dir, `${tag}.sql`), 'CREATE TABLE dummy_test (id text primary key);')

  const journalPath = join(dir, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as { entries: unknown[] }
  journal.entries.push({ idx: journal.entries.length, version: '6', when: Date.now(), tag, breakpoints: true })
  writeFileSync(journalPath, JSON.stringify(journal, null, 2))

  return dir
}

function existeTabela(db: PsiTrackDatabase, nome: string): boolean {
  return (
    db.$client.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`).get(nome) !== undefined
  )
}

/**
 * Clona a pasta real de migrations, mas remove qualquer migration numerada
 * >= 4 (a partir de que número, não importa — usa o mesmo truque genérico
 * de migration-0003.test.ts) — simula "banco de antes da Etapa 14", quando
 * a tabela `anexo` ainda não existia.
 */
function criarPastaSemAnexo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'psitrack-sem-anexo-'))
  cpSync(MIGRATIONS_FOLDER, dir, { recursive: true })

  const numeroDaMigration = (nomeOuTag: string): number => Number(nomeOuTag.slice(0, 4))
  for (const arquivo of readdirSync(dir)) {
    if (arquivo.endsWith('.sql') && numeroDaMigration(arquivo) >= 4) rmSync(join(dir, arquivo))
  }

  const journalPath = join(dir, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as { entries: { tag: string }[] }
  journal.entries = journal.entries.filter((entrada) => numeroDaMigration(entrada.tag) < 4)
  writeFileSync(journalPath, JSON.stringify(journal, null, 2))

  return dir
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
    migrarComSeguranca({ db, dek, migrationsFolder: MIGRATIONS_FOLDER, backupDir: temp.dir, anexosDir: join(temp.dir, 'anexos') })

    const arquivosDeSnapshot = readdirSync(temp.dir).filter((f) => f.startsWith('pre-migration-'))
    expect(arquivosDeSnapshot).toHaveLength(0)
  })

  it('banco existente com migration pendente gera snapshot verificado antes do DDL', async () => {
    const { migrarComSeguranca } = await import('./pre-migration')
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)

    db = openDatabase({ filePath: temp.filePath, dek })
    runMigrations(db, MIGRATIONS_FOLDER) // leva o banco pra versão real atual
    db.$client.close()

    const pastaComExtra = criarPastaMigrationsComExtra() // "app" entende uma versão a mais
    db = openDatabase({ filePath: temp.filePath, dek })
    migrarComSeguranca({ db, dek, migrationsFolder: pastaComExtra, backupDir: temp.dir, anexosDir: join(temp.dir, 'anexos') })

    const arquivosDeSnapshot = readdirSync(temp.dir).filter(
      (f) => f.startsWith(`pre-migration-v${VERSAO_COM_EXTRA}-`) && f.endsWith('.db')
    )
    expect(arquivosDeSnapshot).toHaveLength(1)
    expect(existeTabela(db, 'dummy_test')).toBe(true) // migration pendente foi mesmo aplicada
  })

  it('snapshot pré-migração de banco com anexo inclui o blob (SPEC-fase-3.md)', async () => {
    const { migrarComSeguranca } = await import('./pre-migration')
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)
    const anexosDir = mkdtempSync(join(tmpdir(), 'psitrack-anexos-'))

    db = openDatabase({ filePath: temp.filePath, dek })
    runMigrations(db, MIGRATIONS_FOLDER)
    const pacienteId = criarPaciente(db, { nome: 'Paciente Teste' }).id
    const anexo = salvarAnexo(db, anexosDir, dek, Buffer.from('laudo em pdf'), {
      pacienteId,
      classificacao: 'prontuario',
      nomeOriginal: 'laudo.pdf',
      mime: 'application/pdf'
    })
    db.$client.close()

    const pastaComExtra = criarPastaMigrationsComExtra()
    db = openDatabase({ filePath: temp.filePath, dek })
    migrarComSeguranca({ db, dek, migrationsFolder: pastaComExtra, backupDir: temp.dir, anexosDir })

    const [pastaDeAnexos] = readdirSync(temp.dir).filter(
      (f) => f.startsWith(`pre-migration-v${VERSAO_COM_EXTRA}-`) && f.endsWith('-anexos')
    )
    expect(pastaDeAnexos).toBeDefined()
    expect(existsSync(join(temp.dir, pastaDeAnexos!, `${anexo.id}.enc`))).toBe(true)
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
          rowCountsMatchSource: false,
          blobs: { ok: false, problemas: ['erro simulado'] }
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
      migrarComSeguranca({ db: db!, dek, migrationsFolder: pastaComExtra, backupDir: temp.dir, anexosDir: join(temp.dir, 'anexos') })
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
      migrarComSeguranca({ db: db!, dek, migrationsFolder: pastaComExtra, backupDir: temp.dir, anexosDir: join(temp.dir, 'anexos') })
    ).toThrow(/ENOSPC/)

    expect(existeTabela(db, 'dummy_test')).toBe(false)
  })

  it('banco de antes da Etapa 14 (sem tabela anexo) migra sem quebrar no snapshot pré-migração', async () => {
    const { migrarComSeguranca } = await import('./pre-migration')
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)

    const pastaSemAnexo = criarPastaSemAnexo()
    db = openDatabase({ filePath: temp.filePath, dek })
    runMigrations(db, pastaSemAnexo) // banco no estado pré-Etapa-14: tabela `anexo` não existe
    expect(existeTabela(db, 'anexo')).toBe(false)
    db.$client.close()

    db = openDatabase({ filePath: temp.filePath, dek })
    // `MIGRATIONS_FOLDER` (pasta real, com a migration do `anexo`) é o que o
    // app entende hoje — antes do fix, `listarBlobsParaManifesto` explodia
    // aqui com "no such table: anexo" porque tentava ler a tabela ANTES da
    // migration que a cria, travando o desbloqueio pra sempre.
    expect(() =>
      migrarComSeguranca({ db: db!, dek, migrationsFolder: MIGRATIONS_FOLDER, backupDir: temp.dir, anexosDir: join(temp.dir, 'anexos') })
    ).not.toThrow()

    expect(existeTabela(db, 'anexo')).toBe(true)
  })
})
