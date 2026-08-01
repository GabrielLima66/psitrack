import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { criarAnotacao } from './anotacoes'
import { criarEvolucao } from './evolucao'
import { coletarParaExport } from './export'
import { criarPaciente } from './pacientes'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'migrations')
const MARCADOR_PRIVADO = 'ZZ_CONTEUDO_QUE_NUNCA_PODE_VAZAR_PRO_EXPORT_ZZ'
const MARCADOR_EVOLUCAO = 'ZZ_EVOLUCAO_QUE_TEM_QUE_APARECER_NO_EXPORT_ZZ'

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

describe('coletarParaExport — invariante I2', () => {
  it('inclui prontuario_evolucao', () => {
    criarEvolucao(db, { pacienteId, conteudo: MARCADOR_EVOLUCAO, dataSessao: '2026-01-10', tipo: 'sessao' })
    const dados = coletarParaExport(db, pacienteId)
    expect(JSON.stringify(dados)).toContain(MARCADOR_EVOLUCAO)
  })

  it('NUNCA inclui anotacao_privada, nem por acidente de estrutura', () => {
    criarAnotacao(db, pacienteId, { titulo: 'Sigiloso', conteudo: MARCADOR_PRIVADO })
    criarEvolucao(db, { pacienteId, conteudo: 'entrada pública normal', dataSessao: '2026-01-10', tipo: 'sessao' })

    const dados = coletarParaExport(db, pacienteId)

    // Checagem de conteúdo: pega vazamento não importa como o objeto for remontado.
    expect(JSON.stringify(dados)).not.toContain(MARCADOR_PRIVADO)

    // Checagem estrutural: pega alguém adicionando uma chave nova (ex.: "anotacoes")
    // que aponte pra anotacao_privada no futuro, mesmo com dado de teste diferente.
    expect(Object.keys(dados)).toEqual(['evolucao'])
  })
})
