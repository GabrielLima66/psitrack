import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { atualizarTemplate, criarTemplate, listarTemplates, removerTemplate } from './mensagemTemplate'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'migrations')

let db: PsiTrackDatabase
let cleanup: () => void

beforeEach(() => {
  const temp = createTempDbPath()
  cleanup = temp.cleanup
  db = openDatabase({ filePath: temp.filePath, dek: randomBytes(32) })
  runMigrations(db, MIGRATIONS_FOLDER)
})

afterEach(() => {
  db.$client.close()
  cleanup()
})

describe('criarTemplate', () => {
  it('cria um template', () => {
    const template = criarTemplate(db, { nome: 'Padrão', corpo: 'Olá {paciente}!' })
    expect(listarTemplates(db).map((t) => t.id)).toEqual([template.id])
  })

  it('só um template padrão ativo por vez', () => {
    const primeiro = criarTemplate(db, { nome: 'A', corpo: 'x', padrao: true })
    const segundo = criarTemplate(db, { nome: 'B', corpo: 'y', padrao: true })

    const templates = listarTemplates(db)
    expect(templates.find((t) => t.id === primeiro.id)?.padrao).toBe(false)
    expect(templates.find((t) => t.id === segundo.id)?.padrao).toBe(true)
  })
})

describe('atualizarTemplate', () => {
  it('marcar como padrão desmarca o anterior', () => {
    const a = criarTemplate(db, { nome: 'A', corpo: 'x', padrao: true })
    const b = criarTemplate(db, { nome: 'B', corpo: 'y' })

    atualizarTemplate(db, b.id, { nome: 'B', corpo: 'y', padrao: true })

    const templates = listarTemplates(db)
    expect(templates.find((t) => t.id === a.id)?.padrao).toBe(false)
    expect(templates.find((t) => t.id === b.id)?.padrao).toBe(true)
  })
})

describe('removerTemplate', () => {
  it('soft delete: some da listagem mas não some do banco', () => {
    const template = criarTemplate(db, { nome: 'A', corpo: 'x' })
    removerTemplate(db, template.id)

    expect(listarTemplates(db)).toHaveLength(0)
  })
})
