import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { criarPaciente } from './pacientes'
import { atualizarAnotacao, criarAnotacao, excluirAnotacao, listarAnotacoes } from './anotacoes'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'migrations')

let db: PsiTrackDatabase
let cleanup: () => void
let pacienteId: string

beforeEach(() => {
  const temp = createTempDbPath()
  cleanup = temp.cleanup
  db = openDatabase({ filePath: temp.filePath, dek: randomBytes(32) })
  runMigrations(db, MIGRATIONS_FOLDER)
  pacienteId = criarPaciente(db, { nome: 'Paciente Teste' }).id
})

afterEach(() => {
  db.$client.close()
  cleanup()
})

describe('criarAnotacao', () => {
  it('cria uma anotação privada', () => {
    const anotacao = criarAnotacao(db, pacienteId, { titulo: 'Hipótese', conteudo: 'Rascunho de hipótese diagnóstica.' })
    expect(anotacao.pacienteId).toBe(pacienteId)
    expect(anotacao.deletedAt).toBeNull()
  })

  it('rejeita conteúdo vazio', () => {
    expect(() => criarAnotacao(db, pacienteId, { conteudo: '   ' })).toThrow()
  })
})

describe('atualizarAnotacao', () => {
  it('altera a MESMA linha e atualiza updated_at — ao contrário da evolução', () => {
    const original = criarAnotacao(db, pacienteId, { conteudo: 'Texto original.' })
    const atualizada = atualizarAnotacao(db, original.id, { conteudo: 'Texto editado.' })

    expect(atualizada.id).toBe(original.id) // mesma linha, não uma nova
    expect(atualizada.conteudo).toBe('Texto editado.')
    expect(atualizada.updatedAt).not.toBe(original.updatedAt)

    const lista = listarAnotacoes(db, pacienteId)
    expect(lista).toHaveLength(1) // não virou 2 linhas como retificarEvolucao faria
    expect(lista[0]?.conteudo).toBe('Texto editado.')
  })
})

describe('excluirAnotacao', () => {
  it('soft delete: some da listagem mas a linha continua no banco', () => {
    const anotacao = criarAnotacao(db, pacienteId, { conteudo: 'Vai ser excluída.' })
    excluirAnotacao(db, anotacao.id)

    expect(listarAnotacoes(db, pacienteId)).toHaveLength(0)

    const linhaCrua = db.$client.prepare('SELECT * FROM anotacao_privada WHERE id = ?').get(anotacao.id) as
      | { deleted_at: string | null }
      | undefined
    expect(linhaCrua).toBeDefined()
    expect(linhaCrua?.deleted_at).not.toBeNull()
  })
})

describe('listarAnotacoes', () => {
  it('não lista anotação de outro paciente', () => {
    const outroPacienteId = criarPaciente(db, { nome: 'Outro' }).id
    criarAnotacao(db, pacienteId, { conteudo: 'a' })
    criarAnotacao(db, outroPacienteId, { conteudo: 'b' })

    expect(listarAnotacoes(db, pacienteId)).toHaveLength(1)
  })
})

describe('nenhuma trigger existe sobre anotacao_privada', () => {
  it('verificado em sqlite_master', () => {
    const triggers = db.$client
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'anotacao_privada'`)
      .all()
    expect(triggers).toHaveLength(0)
  })
})
