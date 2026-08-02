import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { precoVigenteEm } from './contratoPreco'
import { criarPacienteComAtendimento } from './cadastroAtendimento'
import { listarRecorrencias } from './recorrencia'
import { listarSessoesPeriodo } from './sessao'

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

// Janela bem larga: `criarPacienteComAtendimento` usa a data real do relógio
// do sistema como "hoje" pra materializar, então os testes não podem
// assumir que as ocorrências caem num mês específico do calendário.
const DESDE_SEMPRE = '2000-01-01T00:00:00.000Z'
const ATE_SEMPRE = '2100-01-01T00:00:00.000Z'

describe('criarPacienteComAtendimento', () => {
  it('cria paciente + N recorrências + contrato, e já materializa a agenda (D24)', () => {
    const paciente = criarPacienteComAtendimento(db, {
      paciente: { nome: 'Maria Teste' },
      recorrencias: [
        { diaSemana: 2, horaLocal: '14:00', duracaoMin: 50, modalidade: 'presencial', vigenciaInicio: '2026-01-06' },
        { diaSemana: 4, horaLocal: '16:00', duracaoMin: 50, modalidade: 'online', vigenciaInicio: '2026-01-06' }
      ],
      contrato: { modalidade: 'avulso', valorCentavos: 15000, vigenciaInicio: '2026-01-06' }
    })

    expect(paciente.nome).toBe('Maria Teste')
    expect(listarRecorrencias(db, paciente.id)).toHaveLength(2)
    expect(precoVigenteEm(db, paciente.id, '2026-02-01')?.valorCentavos).toBe(15000)

    const sessoes = listarSessoesPeriodo(db, DESDE_SEMPRE, ATE_SEMPRE).filter((s) => s.pacienteId === paciente.id)
    expect(sessoes).toHaveLength(24) // 12 semanas x 2 séries
  })

  it('sessão às 14:00 em São Paulo é convertida corretamente pra UTC (17:00Z, UTC-3)', () => {
    const paciente = criarPacienteComAtendimento(db, {
      paciente: { nome: 'Ana Teste' },
      recorrencias: [{ diaSemana: 2, horaLocal: '14:00', duracaoMin: 50, modalidade: 'presencial', vigenciaInicio: '2026-01-06' }],
      contrato: { modalidade: 'avulso', valorCentavos: 15000, vigenciaInicio: '2026-01-06' }
    })
    const sessoes = listarSessoesPeriodo(db, DESDE_SEMPRE, ATE_SEMPRE).filter((s) => s.pacienteId === paciente.id)
    expect(sessoes.length).toBeGreaterThan(0)
    for (const s of sessoes) {
      expect(new Date(s.inicioUtc).getUTCHours()).toBe(17) // 14:00 local + 3h de deslocamento
    }
  })

  it('funciona sem nenhuma recorrência — paciente só avulso, mas contrato é obrigatório', () => {
    const paciente = criarPacienteComAtendimento(db, {
      paciente: { nome: 'Sem Horário Fixo' },
      recorrencias: [],
      contrato: { modalidade: 'avulso', valorCentavos: 20000, vigenciaInicio: '2026-01-01' }
    })
    expect(listarRecorrencias(db, paciente.id)).toHaveLength(0)
    expect(precoVigenteEm(db, paciente.id, '2026-06-01')?.valorCentavos).toBe(20000)
  })

  it('é atômico: recorrência inválida no meio da lista impede a criação do paciente inteiro', () => {
    const antes = db.$client.prepare('SELECT count(*) as c FROM pacientes').get() as { c: number }

    expect(() =>
      criarPacienteComAtendimento(db, {
        paciente: { nome: 'Paciente Deveria Sumir' },
        recorrencias: [
          { diaSemana: 2, horaLocal: '14:00', duracaoMin: 50, modalidade: 'presencial', vigenciaInicio: '2026-01-06' },
          // hora inválida — deve rejeitar e desfazer TUDO, inclusive o paciente já "criado" nesta chamada
          { diaSemana: 4, horaLocal: '99:99', duracaoMin: 50, modalidade: 'online', vigenciaInicio: '2026-01-06' }
        ],
        contrato: { modalidade: 'avulso', valorCentavos: 15000, vigenciaInicio: '2026-01-06' }
      })
    ).toThrow()

    const depois = db.$client.prepare('SELECT count(*) as c FROM pacientes').get() as { c: number }
    expect(depois.c).toBe(antes.c)
  })
})
