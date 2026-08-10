import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { prontuarioEvolucao } from '../schema'
import { createTempDbPath } from '../test-support'
import { uuidv7 } from '../uuidv7'
import {
  alterarStatusPaciente,
  arquivarPaciente,
  atualizarPaciente,
  criarPaciente,
  listarPacientes,
  normalizarBusca,
  obterPaciente,
  restaurarPaciente
} from './pacientes'
import { utcParaDataLocal } from '../timezone'
import { criarRecorrencia, listarRecorrencias } from './recorrencia'
import { criarSessaoAvulsa, listarSessoesPeriodo, materializarRecorrencia } from './sessao'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'migrations')
const CPF_VALIDO_1 = '11144477735'
const CPF_VALIDO_2 = '52998224725'

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

describe('normalizarBusca', () => {
  it('remove acento e caixa', () => {
    expect(normalizarBusca('José da Silva')).toBe('jose da silva')
  })
})

describe('criarPaciente', () => {
  it('cria com o mínimo (só nome) e deriva nomeBusca', () => {
    const paciente = criarPaciente(db, { nome: 'José da Silva' })
    expect(paciente.nomeBusca).toBe('jose da silva')
    expect(paciente.status).toBe('ativo')
    expect(paciente.deletedAt).toBeNull()
  })

  it('rejeita nome vazio', () => {
    expect(() => criarPaciente(db, { nome: '  ' })).toThrow()
  })

  it('rejeita CPF com dígito verificador errado', () => {
    expect(() => criarPaciente(db, { nome: 'Teste', cpf: '11144477736' })).toThrow()
  })

  it('rejeita data de nascimento no futuro', () => {
    expect(() => criarPaciente(db, { nome: 'Teste', dataNascimento: '2999-01-01' })).toThrow()
  })

  it('rejeita CPF duplicado entre pacientes ativos', () => {
    criarPaciente(db, { nome: 'Paciente 1', cpf: CPF_VALIDO_1 })
    expect(() => criarPaciente(db, { nome: 'Paciente 2', cpf: CPF_VALIDO_1 })).toThrow(/cpf/i)
  })
})

describe('atualizarPaciente', () => {
  it('atualiza campos e recalcula nomeBusca', () => {
    const paciente = criarPaciente(db, { nome: 'Maria' })
    const atualizado = atualizarPaciente(db, paciente.id, { nome: 'Maria', nomeSocial: 'Mari' })
    expect(atualizado.nomeSocial).toBe('Mari')
    expect(atualizado.nomeBusca).toBe('maria mari')
  })

  it('rejeita CPF que já pertence a outro paciente ativo', () => {
    criarPaciente(db, { nome: 'Paciente 1', cpf: CPF_VALIDO_1 })
    const paciente2 = criarPaciente(db, { nome: 'Paciente 2', cpf: CPF_VALIDO_2 })
    expect(() => atualizarPaciente(db, paciente2.id, { nome: 'Paciente 2', cpf: CPF_VALIDO_1 })).toThrow(/cpf/i)
  })

  it('permite manter o próprio CPF ao atualizar outros campos', () => {
    const paciente = criarPaciente(db, { nome: 'Paciente 1', cpf: CPF_VALIDO_1 })
    expect(() => atualizarPaciente(db, paciente.id, { nome: 'Paciente 1 Editado', cpf: CPF_VALIDO_1 })).not.toThrow()
  })
})

describe('alterarStatusPaciente', () => {
  it('exige motivoEncerramento ao encerrar', () => {
    const paciente = criarPaciente(db, { nome: 'Teste' })
    expect(() => alterarStatusPaciente(db, paciente.id, { status: 'encerrado' })).toThrow()
  })

  it('encerra com motivo e grava statusAlteradoEm', () => {
    const paciente = criarPaciente(db, { nome: 'Teste' })
    const atualizado = alterarStatusPaciente(db, paciente.id, { status: 'encerrado', motivoEncerramento: 'alta' })
    expect(atualizado.status).toBe('encerrado')
    expect(atualizado.motivoEncerramento).toBe('alta')
    expect(atualizado.statusAlteradoEm).not.toBeNull()
  })

  it('encerrar fecha a agenda do paciente: recorrência ativa é encerrada e sessões futuras agendada somem', () => {
    const hoje = utcParaDataLocal(new Date().toISOString())
    const paciente = criarPaciente(db, { nome: 'Teste' })
    const rec = criarRecorrencia(db, paciente.id, {
      diaSemana: 2,
      horaLocal: '14:00',
      duracaoMin: 50,
      modalidade: 'presencial',
      vigenciaInicio: hoje
    })
    materializarRecorrencia(db, rec, hoje)
    criarSessaoAvulsa(db, { pacienteId: paciente.id, dataLocal: '2099-03-10', horaLocal: '14:00', duracaoMin: 50, modalidade: 'presencial' })

    alterarStatusPaciente(db, paciente.id, { status: 'encerrado', motivoEncerramento: 'alta' })

    expect(listarRecorrencias(db, paciente.id)[0]?.vigenciaFim).not.toBeNull()
    expect(listarSessoesPeriodo(db, '2000-01-01T00:00:00.000Z', '2100-01-01T00:00:00.000Z')).toHaveLength(0)
  })

  it('pausar (não encerrar) não mexe na agenda', () => {
    const hoje = utcParaDataLocal(new Date().toISOString())
    const paciente = criarPaciente(db, { nome: 'Teste' })
    const rec = criarRecorrencia(db, paciente.id, {
      diaSemana: 2,
      horaLocal: '14:00',
      duracaoMin: 50,
      modalidade: 'presencial',
      vigenciaInicio: hoje
    })
    materializarRecorrencia(db, rec, hoje)

    alterarStatusPaciente(db, paciente.id, { status: 'pausado' })

    expect(listarRecorrencias(db, paciente.id)[0]?.vigenciaFim).toBeNull()
    expect(listarSessoesPeriodo(db, '2000-01-01T00:00:00.000Z', '2100-01-01T00:00:00.000Z')).toHaveLength(12)
  })
})

describe('arquivar / restaurar', () => {
  it('arquivar não remove a linha do banco (soft delete)', () => {
    const paciente = criarPaciente(db, { nome: 'Teste' })
    arquivarPaciente(db, paciente.id)

    const linha = obterPaciente(db, paciente.id)
    expect(linha).toBeDefined()
    expect(linha?.deletedAt).not.toBeNull()
  })

  it('depois de arquivar, o mesmo CPF pode ser recadastrado em outro paciente', () => {
    const original = criarPaciente(db, { nome: 'Paciente Original', cpf: CPF_VALIDO_1 })
    arquivarPaciente(db, original.id)

    expect(() => criarPaciente(db, { nome: 'Paciente Novo', cpf: CPF_VALIDO_1 })).not.toThrow()
  })

  it('restaurar bloqueia se o CPF já foi reusado por outro paciente ativo', () => {
    const original = criarPaciente(db, { nome: 'Paciente Original', cpf: CPF_VALIDO_1 })
    arquivarPaciente(db, original.id)
    criarPaciente(db, { nome: 'Paciente Novo', cpf: CPF_VALIDO_1 })

    expect(() => restaurarPaciente(db, original.id)).toThrow(/cpf/i)
  })
})

describe('listarPacientes', () => {
  it('busca "jose" encontra "José da Silva" e busca "silva" também', () => {
    criarPaciente(db, { nome: 'José da Silva' })

    expect(listarPacientes(db, { busca: 'jose' })).toHaveLength(1)
    expect(listarPacientes(db, { busca: 'silva' })).toHaveLength(1)
    expect(listarPacientes(db, { busca: 'inexistente' })).toHaveLength(0)
  })

  it('filtra por status e por arquivados, default é só ativos', () => {
    const ativo = criarPaciente(db, { nome: 'Ativo' })
    const paraEncerrar = criarPaciente(db, { nome: 'Encerrado' })
    const paraArquivar = criarPaciente(db, { nome: 'Arquivado' })
    alterarStatusPaciente(db, paraEncerrar.id, { status: 'encerrado', motivoEncerramento: 'alta' })
    arquivarPaciente(db, paraArquivar.id)

    expect(listarPacientes(db).map((p) => p.id)).toEqual(expect.arrayContaining([ativo.id, paraEncerrar.id]))
    expect(listarPacientes(db).map((p) => p.id)).not.toContain(paraArquivar.id)
    expect(listarPacientes(db, { status: 'encerrado' }).map((p) => p.id)).toEqual([paraEncerrar.id])
    expect(listarPacientes(db, { arquivados: true }).map((p) => p.id)).toEqual([paraArquivar.id])
  })

  it('ultimaSessao é null sem nenhuma evolução, e é a data mais recente quando há várias', () => {
    const semSessao = criarPaciente(db, { nome: 'Sem Sessão' })
    const comSessoes = criarPaciente(db, { nome: 'Com Sessões' })

    db.insert(prontuarioEvolucao)
      .values({ id: uuidv7(), pacienteId: comSessoes.id, conteudo: 'a', dataSessao: '2026-01-05', createdAt: new Date().toISOString() })
      .run()
    db.insert(prontuarioEvolucao)
      .values({ id: uuidv7(), pacienteId: comSessoes.id, conteudo: 'b', dataSessao: '2026-02-20', createdAt: new Date().toISOString() })
      .run()
    db.insert(prontuarioEvolucao)
      .values({ id: uuidv7(), pacienteId: comSessoes.id, conteudo: 'c', dataSessao: '2026-01-30', createdAt: new Date().toISOString() })
      .run()

    const lista = listarPacientes(db)
    expect(lista.find((p) => p.id === semSessao.id)?.ultimaSessao).toBeNull()
    expect(lista.find((p) => p.id === comSessoes.id)?.ultimaSessao).toBe('2026-02-20')
  })
})
