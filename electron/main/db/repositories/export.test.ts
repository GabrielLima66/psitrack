import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { salvarAnexo } from '../../anexos/anexoStore'
import { openDatabase, type PsiTrackDatabase } from '../connection'
import { runMigrations } from '../migrate'
import { createTempDbPath } from '../test-support'
import { criarAnotacao } from './anotacoes'
import { criarDiagnostico } from './diagnostico'
import { criarEncaminhamento } from './encaminhamento'
import { criarEvolucao } from './evolucao'
import { coletarParaExport } from './export'
import { salvarFichaClinica } from './fichaClinica'
import { criarMedicamento } from './medicamento'
import { criarPaciente } from './pacientes'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'migrations')
const MARCADOR_PRIVADO = 'ZZ_CONTEUDO_QUE_NUNCA_PODE_VAZAR_PRO_EXPORT_ZZ'
const MARCADOR_EVOLUCAO = 'ZZ_EVOLUCAO_QUE_TEM_QUE_APARECER_NO_EXPORT_ZZ'
const MARCADOR_CLINICO = 'ZZ_DEMANDA_QUE_TEM_QUE_APARECER_NO_EXPORT_ZZ'

let db: PsiTrackDatabase
let cleanup: () => void
let pacienteId: string
let anexosDir: string
let chaveMestra: Buffer

beforeEach(() => {
  const temp = createTempDbPath()
  cleanup = temp.cleanup
  db = openDatabase({ filePath: temp.filePath, dek: randomBytes(32) })
  runMigrations(db, MIGRATIONS_FOLDER)
  pacienteId = criarPaciente(db, { nome: 'Paciente Teste' }).id
  anexosDir = mkdtempSync(join(tmpdir(), 'psitrack-anexos-'))
  chaveMestra = randomBytes(32)
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
    expect(Object.keys(dados)).toEqual([
      'evolucao',
      'anexos',
      'fichaClinica',
      'medicamentos',
      'diagnosticos',
      'encaminhamentos'
    ])
  })

  it('inclui anexo classificado como prontuario (Etapa 16)', () => {
    const anexo = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('laudo'), {
      pacienteId,
      classificacao: 'prontuario',
      nomeOriginal: 'laudo.pdf',
      mime: 'application/pdf'
    })
    const dados = coletarParaExport(db, pacienteId)
    expect(dados.anexos.map((a) => a.id)).toContain(anexo.id)
  })

  it('NUNCA inclui anexo classificado como privado, nem por acidente de estrutura', () => {
    // marcador na DESCRIÇÃO (metadado que de fato viaja no export) — não no
    // conteúdo do arquivo, que nunca entra em `dados` de qualquer forma.
    const anexoPrivado = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('conteúdo qualquer'), {
      pacienteId,
      classificacao: 'privado',
      nomeOriginal: 'anotacao-pessoal.txt',
      mime: 'text/plain',
      descricao: MARCADOR_PRIVADO
    })

    const dados = coletarParaExport(db, pacienteId)

    expect(dados.anexos.map((a) => a.id)).not.toContain(anexoPrivado.id)
    expect(JSON.stringify(dados)).not.toContain(MARCADOR_PRIVADO)
  })

  it('inclui as informações clínicas inteiras (SPEC-fase-5.md D48)', () => {
    salvarFichaClinica(db, pacienteId, { demandaInicial: MARCADOR_CLINICO, abordagem: 'TCC' })
    criarMedicamento(db, pacienteId, { nome: 'Sertralina', dose: '50mg' })
    criarDiagnostico(db, pacienteId, { descricao: 'Transtorno de ansiedade' })
    criarEncaminhamento(db, pacienteId, { paraQuem: 'Dra. Fulana', data: '2026-02-10' })

    const dados = coletarParaExport(db, pacienteId)

    expect(JSON.stringify(dados)).toContain(MARCADOR_CLINICO)
    expect(dados.medicamentos).toHaveLength(1)
    expect(dados.diagnosticos).toHaveLength(1)
    expect(dados.encaminhamentos).toHaveLength(1)
  })
})
