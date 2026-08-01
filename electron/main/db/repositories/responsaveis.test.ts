import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { criarPaciente } from './pacientes'
import { atualizarResponsavel, criarResponsavel, listarResponsaveis, removerResponsavel } from './responsaveis'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'migrations')

let db: PsiTrackDatabase
let cleanup: () => void
let pacienteId: string

beforeEach(() => {
  const temp = createTempDbPath()
  cleanup = temp.cleanup
  db = openDatabase({ filePath: temp.filePath, dek: randomBytes(32) })
  runMigrations(db, MIGRATIONS_FOLDER)
  pacienteId = criarPaciente(db, { nome: 'Paciente Menor' }).id
})

afterEach(() => {
  db.$client.close()
  cleanup()
})

describe('criarResponsavel', () => {
  it('cria um responsável vinculado ao paciente', () => {
    const responsavel = criarResponsavel(db, pacienteId, { nome: 'Mãe', parentesco: 'mae' })
    expect(listarResponsaveis(db, pacienteId).map((r) => r.id)).toEqual([responsavel.id])
  })

  it('só um responsável principal ativo por paciente', () => {
    const primeiro = criarResponsavel(db, pacienteId, { nome: 'Mãe', parentesco: 'mae', principal: true })
    const segundo = criarResponsavel(db, pacienteId, { nome: 'Pai', parentesco: 'pai', principal: true })

    const responsaveis = listarResponsaveis(db, pacienteId)
    expect(responsaveis.find((r) => r.id === primeiro.id)?.principal).toBe(false)
    expect(responsaveis.find((r) => r.id === segundo.id)?.principal).toBe(true)
  })

  it('pagador não precisa ser o mesmo que principal', () => {
    const mae = criarResponsavel(db, pacienteId, { nome: 'Mãe', parentesco: 'mae', principal: true, pagador: false })
    const pai = criarResponsavel(db, pacienteId, { nome: 'Pai', parentesco: 'pai', pagador: true })

    const responsaveis = listarResponsaveis(db, pacienteId)
    expect(responsaveis.find((r) => r.id === mae.id)?.pagador).toBe(false)
    expect(responsaveis.find((r) => r.id === pai.id)?.pagador).toBe(true)
  })
})

describe('atualizarResponsavel', () => {
  it('marcar como principal desmarca o anterior', () => {
    const mae = criarResponsavel(db, pacienteId, { nome: 'Mãe', parentesco: 'mae', principal: true })
    const pai = criarResponsavel(db, pacienteId, { nome: 'Pai', parentesco: 'pai' })

    atualizarResponsavel(db, pai.id, { nome: 'Pai', parentesco: 'pai', principal: true })

    const responsaveis = listarResponsaveis(db, pacienteId)
    expect(responsaveis.find((r) => r.id === mae.id)?.principal).toBe(false)
    expect(responsaveis.find((r) => r.id === pai.id)?.principal).toBe(true)
  })
})

describe('removerResponsavel', () => {
  it('soft delete: some da listagem mas não some do banco', () => {
    const responsavel = criarResponsavel(db, pacienteId, { nome: 'Mãe', parentesco: 'mae' })
    removerResponsavel(db, responsavel.id)

    expect(listarResponsaveis(db, pacienteId)).toHaveLength(0)
  })
})
