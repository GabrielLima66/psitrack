import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from './connection'
import { runMigrations } from './migrate'
import { pacientes, prontuarioEvolucao } from './schema'
import { createTempDbPath } from './test-support'
import { uuidv7 } from './uuidv7'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), 'migrations')

let db: PsiTrackDatabase
let cleanup: () => void
let pacienteId: string

beforeEach(() => {
  const temp = createTempDbPath()
  cleanup = temp.cleanup
  db = openDatabase({ filePath: temp.filePath, dek: randomBytes(32) })
  runMigrations(db, MIGRATIONS_FOLDER)

  pacienteId = uuidv7()
  db.insert(pacientes)
    .values({
      id: pacienteId,
      nome: 'Paciente Teste',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    .run()
})

afterEach(() => {
  db.$client.close()
  cleanup()
})

describe('trigger append-only de prontuario_evolucao', () => {
  it('rejeita UPDATE', () => {
    const id = uuidv7()
    db.insert(prontuarioEvolucao)
      .values({ id, pacienteId, conteudo: 'evolução original', createdAt: new Date().toISOString() })
      .run()

    expect(() =>
      db.update(prontuarioEvolucao).set({ conteudo: 'tentativa de reescrever' }).where(eq(prontuarioEvolucao.id, id)).run()
    ).toThrow()
  })

  it('rejeita DELETE', () => {
    const id = uuidv7()
    db.insert(prontuarioEvolucao)
      .values({ id, pacienteId, conteudo: 'evolução original', createdAt: new Date().toISOString() })
      .run()

    expect(() => db.delete(prontuarioEvolucao).where(eq(prontuarioEvolucao.id, id)).run()).toThrow()
  })

  it('correção via nova linha com retifica_id funciona normalmente', () => {
    const originalId = uuidv7()
    db.insert(prontuarioEvolucao)
      .values({ id: originalId, pacienteId, conteudo: 'evolução com erro de digitação', createdAt: new Date().toISOString() })
      .run()

    const retificacaoId = uuidv7()
    db.insert(prontuarioEvolucao)
      .values({
        id: retificacaoId,
        pacienteId,
        conteudo: 'evolução corrigida',
        retificaId: originalId,
        createdAt: new Date().toISOString()
      })
      .run()

    const linhas = db.select().from(prontuarioEvolucao).all()
    expect(linhas).toHaveLength(2)
    expect(linhas.find((linha) => linha.id === retificacaoId)?.retificaId).toBe(originalId)
  })
})
