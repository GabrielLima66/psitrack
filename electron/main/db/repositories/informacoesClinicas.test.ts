import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { atualizarDiagnostico, criarDiagnostico, listarDiagnosticos, removerDiagnostico } from './diagnostico'
import { criarEncaminhamento, listarEncaminhamentos, removerEncaminhamento } from './encaminhamento'
import { obterFichaClinica, salvarFichaClinica } from './fichaClinica'
import { atualizarMedicamento, criarMedicamento, listarMedicamentos, removerMedicamento } from './medicamento'
import { criarPaciente } from './pacientes'

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

describe('fichaClinica', () => {
  it('paciente sem ficha devolve null, não erro', () => {
    expect(obterFichaClinica(db, pacienteId)).toBeNull()
  })

  it('salvar duas vezes atualiza a mesma linha, nunca cria a segunda', () => {
    const primeira = salvarFichaClinica(db, pacienteId, { demandaInicial: 'Ansiedade no trabalho', abordagem: 'TCC' })
    const segunda = salvarFichaClinica(db, pacienteId, { demandaInicial: 'Ansiedade e insônia', abordagem: 'TCC' })

    expect(segunda.id).toBe(primeira.id)
    expect(segunda.demandaInicial).toBe('Ansiedade e insônia')
    expect(obterFichaClinica(db, pacienteId)?.id).toBe(primeira.id)
  })
})

describe('medicamento', () => {
  it('fim = null é "em uso"; preencher fim move pro histórico sem apagar a linha', () => {
    const emUso = criarMedicamento(db, pacienteId, { nome: 'Sertralina', dose: '50mg' })
    expect(emUso.fim).toBeNull()

    const encerrado = atualizarMedicamento(db, emUso.id, { nome: 'Sertralina', dose: '50mg', fim: '2026-03-01' })

    expect(encerrado.id).toBe(emUso.id) // mesma linha, nunca uma nova
    expect(encerrado.fim).toBe('2026-03-01')
    expect(listarMedicamentos(db, pacienteId)).toHaveLength(1)
  })

  it('lista em uso primeiro, encerrados depois', () => {
    criarMedicamento(db, pacienteId, { nome: 'Antigo', fim: '2025-06-01' })
    criarMedicamento(db, pacienteId, { nome: 'Atual' })

    expect(listarMedicamentos(db, pacienteId).map((m) => m.nome)).toEqual(['Atual', 'Antigo'])
  })

  it('remover é soft delete: some da listagem, continua no banco', () => {
    const medicamento = criarMedicamento(db, pacienteId, { nome: 'Sertralina' })
    removerMedicamento(db, medicamento.id)

    expect(listarMedicamentos(db, pacienteId)).toHaveLength(0)
    const cru = db.$client.prepare('SELECT deleted_at FROM paciente_medicamento WHERE id = ?').get(medicamento.id) as {
      deleted_at: string | null
    }
    expect(cru.deleted_at).not.toBeNull()
  })

  it('rejeita nome vazio', () => {
    expect(() => criarMedicamento(db, pacienteId, { nome: '   ' })).toThrow()
  })
})

describe('diagnostico', () => {
  it('editar atualiza a linha e o updatedAt (oposto da evolução, D43)', () => {
    const criado = criarDiagnostico(db, pacienteId, { descricao: 'Ansiedade', data: '2026-01-10' })
    const atualizado = atualizarDiagnostico(db, criado.id, { descricao: 'Transtorno de ansiedade generalizada', data: '2026-01-10' })

    expect(atualizado.id).toBe(criado.id)
    expect(atualizado.descricao).toBe('Transtorno de ansiedade generalizada')
    expect(listarDiagnosticos(db, pacienteId)).toHaveLength(1)
  })

  it('lista mais recente primeiro', () => {
    criarDiagnostico(db, pacienteId, { descricao: 'Antigo', data: '2025-01-10' })
    criarDiagnostico(db, pacienteId, { descricao: 'Recente', data: '2026-01-10' })

    expect(listarDiagnosticos(db, pacienteId).map((d) => d.descricao)).toEqual(['Recente', 'Antigo'])
  })

  it('remover é soft delete', () => {
    const diagnostico = criarDiagnostico(db, pacienteId, { descricao: 'Ansiedade' })
    removerDiagnostico(db, diagnostico.id)
    expect(listarDiagnosticos(db, pacienteId)).toHaveLength(0)
  })
})

describe('encaminhamento', () => {
  it('exige para quem e data', () => {
    expect(() => criarEncaminhamento(db, pacienteId, { paraQuem: '', data: '2026-02-10' })).toThrow()
    expect(() => criarEncaminhamento(db, pacienteId, { paraQuem: 'Dra. Fulana', data: 'ontem' })).toThrow()
  })

  it('lista mais recente primeiro e remove por soft delete', () => {
    criarEncaminhamento(db, pacienteId, { paraQuem: 'Psiquiatra', data: '2025-05-02' })
    const recente = criarEncaminhamento(db, pacienteId, { paraQuem: 'Neurologista', data: '2026-02-10' })

    expect(listarEncaminhamentos(db, pacienteId).map((e) => e.paraQuem)).toEqual(['Neurologista', 'Psiquiatra'])

    removerEncaminhamento(db, recente.id)
    expect(listarEncaminhamentos(db, pacienteId).map((e) => e.paraQuem)).toEqual(['Psiquiatra'])
  })
})

describe('isolamento entre pacientes', () => {
  it('informação clínica de um paciente nunca aparece na do outro', () => {
    const outroId = criarPaciente(db, { nome: 'Outro Paciente' }).id
    criarMedicamento(db, pacienteId, { nome: 'Sertralina' })
    salvarFichaClinica(db, pacienteId, { demandaInicial: 'Ansiedade' })

    expect(listarMedicamentos(db, outroId)).toHaveLength(0)
    expect(obterFichaClinica(db, outroId)).toBeNull()
  })
})
