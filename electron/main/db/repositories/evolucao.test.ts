import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { criarPaciente } from './pacientes'
import { criarEvolucao, listarEvolucoes, retificarEvolucao } from './evolucao'

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

describe('criarEvolucao', () => {
  it('cria uma entrada de evolução', () => {
    const evolucao = criarEvolucao(db, { pacienteId, conteudo: 'Primeira sessão.', dataSessao: '2026-01-10', tipo: 'sessao' })
    expect(evolucao.pacienteId).toBe(pacienteId)
    expect(evolucao.retificaId).toBeNull()
    expect(evolucao.motivoRetificacao).toBeNull()
  })

  it('rejeita conteúdo vazio', () => {
    expect(() => criarEvolucao(db, { pacienteId, conteudo: '   ', dataSessao: '2026-01-10', tipo: 'sessao' })).toThrow()
  })

  it('data_sessao retroativa é aceita; created_at reflete o momento da digitação, não a data da sessão', () => {
    const antes = new Date().toISOString()
    const evolucao = criarEvolucao(db, { pacienteId, conteudo: 'Sessão de mês passado.', dataSessao: '2020-03-15', tipo: 'sessao' })
    expect(evolucao.dataSessao).toBe('2020-03-15')
    expect(evolucao.createdAt >= antes).toBe(true)
  })
})

describe('listarEvolucoes', () => {
  it('ordena por data_sessao desc', () => {
    criarEvolucao(db, { pacienteId, conteudo: 'a', dataSessao: '2026-01-05', tipo: 'sessao' })
    criarEvolucao(db, { pacienteId, conteudo: 'b', dataSessao: '2026-02-20', tipo: 'sessao' })
    criarEvolucao(db, { pacienteId, conteudo: 'c', dataSessao: '2026-01-30', tipo: 'sessao' })

    const lista = listarEvolucoes(db, pacienteId)
    expect(lista.map((e) => e.dataSessao)).toEqual(['2026-02-20', '2026-01-30', '2026-01-05'])
  })

  it('não lista evolução de outro paciente', () => {
    const outroPacienteId = criarPaciente(db, { nome: 'Outro Paciente' }).id
    criarEvolucao(db, { pacienteId, conteudo: 'a', dataSessao: '2026-01-05', tipo: 'sessao' })
    criarEvolucao(db, { pacienteId: outroPacienteId, conteudo: 'b', dataSessao: '2026-01-06', tipo: 'sessao' })

    expect(listarEvolucoes(db, pacienteId)).toHaveLength(1)
  })
})

describe('retificarEvolucao', () => {
  it('exige motivo da retificação', () => {
    const original = criarEvolucao(db, { pacienteId, conteudo: 'Texto com erro.', dataSessao: '2026-01-10', tipo: 'sessao' })
    expect(() =>
      retificarEvolucao(db, { retificaId: original.id, conteudo: 'Texto corrigido.', dataSessao: '2026-01-10', tipo: 'sessao', motivoRetificacao: '' })
    ).toThrow()
  })

  it('grava retificaId e mantém a entrada original intocada', () => {
    const original = criarEvolucao(db, { pacienteId, conteudo: 'Texto com erro.', dataSessao: '2026-01-10', tipo: 'sessao' })
    const retificacao = retificarEvolucao(db, {
      retificaId: original.id,
      conteudo: 'Texto corrigido.',
      dataSessao: '2026-01-10',
      tipo: 'sessao',
      motivoRetificacao: 'Erro de digitação no texto original.'
    })

    expect(retificacao.retificaId).toBe(original.id)
    expect(retificacao.pacienteId).toBe(pacienteId)

    const lista = listarEvolucoes(db, pacienteId)
    const originalNaLista = lista.find((e) => e.id === original.id)
    expect(originalNaLista?.conteudo).toBe('Texto com erro.') // original nunca muda
  })

  it('cadeia de 3 retificações: as 3 entradas existem, encadeadas na ordem certa', () => {
    const original = criarEvolucao(db, { pacienteId, conteudo: 'v1', dataSessao: '2026-01-10', tipo: 'sessao' })
    const v2 = retificarEvolucao(db, {
      retificaId: original.id,
      conteudo: 'v2',
      dataSessao: '2026-01-10',
      tipo: 'sessao',
      motivoRetificacao: 'correção 1'
    })
    const v3 = retificarEvolucao(db, {
      retificaId: v2.id,
      conteudo: 'v3',
      dataSessao: '2026-01-10',
      tipo: 'sessao',
      motivoRetificacao: 'correção 2'
    })

    const lista = listarEvolucoes(db, pacienteId)
    expect(lista).toHaveLength(3)
    expect(lista.find((e) => e.id === original.id)?.retificaId).toBeNull()
    expect(lista.find((e) => e.id === v2.id)?.retificaId).toBe(original.id)
    expect(lista.find((e) => e.id === v3.id)?.retificaId).toBe(v2.id)
  })

  it('retificar apontando pra id inexistente falha com mensagem clara', () => {
    expect(() =>
      retificarEvolucao(db, {
        retificaId: 'id-que-nao-existe',
        conteudo: 'x',
        dataSessao: '2026-01-10',
        tipo: 'sessao',
        motivoRetificacao: 'motivo'
      })
    ).toThrow(/não encontrada/i)
  })
})
