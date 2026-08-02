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
      nomeBusca: 'paciente teste',
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
      .values({ id, pacienteId, conteudo: 'evolução original', dataSessao: '2026-01-15', createdAt: new Date().toISOString() })
      .run()

    expect(() =>
      db.update(prontuarioEvolucao).set({ conteudo: 'tentativa de reescrever' }).where(eq(prontuarioEvolucao.id, id)).run()
    ).toThrow()
  })

  it('rejeita DELETE', () => {
    const id = uuidv7()
    db.insert(prontuarioEvolucao)
      .values({ id, pacienteId, conteudo: 'evolução original', dataSessao: '2026-01-15', createdAt: new Date().toISOString() })
      .run()

    expect(() => db.delete(prontuarioEvolucao).where(eq(prontuarioEvolucao.id, id)).run()).toThrow()
  })

  // Regressão pós-migration 0002: ADD COLUMN não deve ter enfraquecido a
  // trigger — tentar mexer nas colunas novas (dataSessao/tipo) também tem
  // que ser bloqueado, não só as colunas que já existiam na 0001.
  it('rejeita UPDATE que mexe só nas colunas novas (dataSessao/tipo)', () => {
    const id = uuidv7()
    db.insert(prontuarioEvolucao)
      .values({ id, pacienteId, conteudo: 'evolução original', dataSessao: '2026-01-15', createdAt: new Date().toISOString() })
      .run()

    expect(() =>
      db.update(prontuarioEvolucao).set({ dataSessao: '2026-02-01', tipo: 'contato' }).where(eq(prontuarioEvolucao.id, id)).run()
    ).toThrow()
  })

  // Regressão pós-migration 0003: idem, agora pra sessao_id (adicionada
  // nesta migration pra ligar evolução à sessão da agenda).
  it('rejeita UPDATE que mexe só na coluna nova (sessao_id)', () => {
    const id = uuidv7()
    db.insert(prontuarioEvolucao)
      .values({ id, pacienteId, conteudo: 'evolução original', dataSessao: '2026-01-15', createdAt: new Date().toISOString() })
      .run()

    expect(() =>
      db.update(prontuarioEvolucao).set({ sessaoId: uuidv7() }).where(eq(prontuarioEvolucao.id, id)).run()
    ).toThrow()
  })

  it('correção via nova linha com retifica_id funciona normalmente', () => {
    const originalId = uuidv7()
    db.insert(prontuarioEvolucao)
      .values({
        id: originalId,
        pacienteId,
        conteudo: 'evolução com erro de digitação',
        dataSessao: '2026-01-15',
        createdAt: new Date().toISOString()
      })
      .run()

    const retificacaoId = uuidv7()
    db.insert(prontuarioEvolucao)
      .values({
        id: retificacaoId,
        pacienteId,
        conteudo: 'evolução corrigida',
        retificaId: originalId,
        motivoRetificacao: 'erro de digitação no texto original',
        dataSessao: '2026-01-15',
        createdAt: new Date().toISOString()
      })
      .run()

    const linhas = db.select().from(prontuarioEvolucao).all()
    expect(linhas).toHaveLength(2)
    expect(linhas.find((linha) => linha.id === retificacaoId)?.retificaId).toBe(originalId)
  })
})
