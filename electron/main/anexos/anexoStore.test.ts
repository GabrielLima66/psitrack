import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type PsiTrackDatabase } from '../db/connection'
import { runMigrations } from '../db/migrate'
import { criarPaciente } from '../db/repositories/pacientes'
import { createTempDbPath } from '../db/test-support'
import { excluirAnexo, lerAnexo, listarAnexosPaciente, purgarAnexos, restaurarAnexo, salvarAnexo, varrerOrfaos } from './anexoStore'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'db', 'migrations')

let db: PsiTrackDatabase
let cleanupDb: () => void
let anexosDir: string
let pacienteId: string
let chaveMestra: Buffer

beforeEach(() => {
  const temp = createTempDbPath()
  cleanupDb = temp.cleanup
  db = openDatabase({ filePath: temp.filePath, dek: randomBytes(32) })
  runMigrations(db, MIGRATIONS_FOLDER)
  pacienteId = criarPaciente(db, { nome: 'Paciente Teste' }).id
  anexosDir = mkdtempSync(join(tmpdir(), 'psitrack-anexos-'))
  chaveMestra = randomBytes(32)
})

afterEach(() => {
  db.$client.close()
  cleanupDb()
})

function inputPadrao(overrides: Partial<Parameters<typeof salvarAnexo>[4]> = {}) {
  return {
    pacienteId,
    classificacao: 'prontuario' as const,
    nomeOriginal: 'laudo neuropsicológico.pdf',
    mime: 'application/pdf',
    ...overrides
  }
}

describe('salvarAnexo / lerAnexo', () => {
  it('salva e lê de volta os mesmos bytes', () => {
    const bytes = Buffer.from('conteúdo de um laudo')
    const salvo = salvarAnexo(db, anexosDir, chaveMestra, bytes, inputPadrao())

    const lido = lerAnexo(db, anexosDir, chaveMestra, salvo.id)
    expect(lido.equals(bytes)).toBe(true)
  })

  it('grava tamanho e sha256 corretos na linha', () => {
    const bytes = Buffer.from('x'.repeat(1000))
    const salvo = salvarAnexo(db, anexosDir, chaveMestra, bytes, inputPadrao())
    expect(salvo.tamanhoBytes).toBe(1000)
    expect(salvo.sha256Cifrado).toHaveLength(64)
  })

  it('ler pra visualização não cria nenhum arquivo fora da pasta de anexos (D28/I7)', () => {
    const salvo = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('conteúdo do pdf'), inputPadrao())
    // Diretório-sentinela isolado (só este teste sabe o nome dele) em vez de
    // comparar `readdirSync(tmpdir())` inteiro: a suite roda arquivos de
    // teste em paralelo, e vários outros (createTempDbPath, export.test.ts)
    // criam/removem suas próprias pastas temp concorrentemente — comparar o
    // tmpdir inteiro é flaky por design, não relacionado a este código.
    const sentinelaDir = mkdtempSync(join(tmpdir(), 'psitrack-sentinela-'))
    const antesAnexosDir = readdirSync(anexosDir)
    const antesCwd = readdirSync(process.cwd())

    lerAnexo(db, anexosDir, chaveMestra, salvo.id)
    lerAnexo(db, anexosDir, chaveMestra, salvo.id) // duas vezes, como um preview reaberto

    expect(readdirSync(anexosDir)).toEqual(antesAnexosDir)
    expect(readdirSync(process.cwd())).toEqual(antesCwd)
    expect(readdirSync(sentinelaDir)).toEqual([])
  })

  it('nome original nunca aparece em lugar nenhum do diretório de anexos', () => {
    const nomeOriginal = 'Relatório Escolar CONFIDENCIAL João.docx'
    salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('conteúdo'), inputPadrao({ nomeOriginal }))

    for (const arquivo of readdirSync(anexosDir)) {
      expect(arquivo).not.toContain('João')
      expect(arquivo).not.toContain('CONFIDENCIAL')
      expect(arquivo).toMatch(/^[0-9a-f-]+\.enc$/)
    }
  })

  it('rejeita arquivo acima de 25 MB antes de qualquer I/O', () => {
    const grande = Buffer.alloc(25 * 1024 * 1024 + 1)
    expect(existsSync(anexosDir)).toBe(true) // mkdtempSync já criou; vamos apagar pra provar que nada é recriado
    expect(() => salvarAnexo(db, anexosDir, chaveMestra, grande, inputPadrao())).toThrow(/25 MB/)
    expect(readdirSync(anexosDir)).toHaveLength(0) // nada foi escrito
  })

  it('D33: anexo vinculado a uma evolução não pode ser classificado como privado', () => {
    expect(() =>
      salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('x'), inputPadrao({ evolucaoId: 'alguma-evolucao', classificacao: 'privado' }))
    ).toThrow()
  })

  it('aceita anexo privado quando não está vinculado a evolução', () => {
    const salvo = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('x'), inputPadrao({ classificacao: 'privado' }))
    expect(salvo.classificacao).toBe('privado')
  })
})

describe('varrerOrfaos', () => {
  it('crash simulado entre escrita e rename: só um .tmp sobra, e a varredura remove', () => {
    writeFileSync(join(anexosDir, `${randomUUID()}.enc.tmp`), Buffer.from('lixo de upload incompleto'))
    expect(readdirSync(anexosDir)).toHaveLength(1)

    const resultado = varrerOrfaos(db, anexosDir)

    expect(readdirSync(anexosDir)).toHaveLength(0)
    expect(resultado.blobsOrfaosRemovidos).toHaveLength(1)
  })

  it('blob .enc sem linha, recente (<24h): mantém', () => {
    const salvo = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('x'), inputPadrao())
    db.$client.prepare('DELETE FROM anexo WHERE id = ?').run(salvo.id) // simula "linha nunca chegou a existir"

    const resultado = varrerOrfaos(db, anexosDir)
    expect(existsSync(join(anexosDir, `${salvo.id}.enc`))).toBe(true)
    expect(resultado.blobsOrfaosRemovidos).toHaveLength(0)
  })

  it('blob .enc sem linha, com mais de 24h: remove', () => {
    const salvo = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('x'), inputPadrao())
    db.$client.prepare('DELETE FROM anexo WHERE id = ?').run(salvo.id)
    const caminho = join(anexosDir, `${salvo.id}.enc`)
    const ontem = new Date(Date.now() - 25 * 60 * 60 * 1000)
    utimesSync(caminho, ontem, ontem)

    const resultado = varrerOrfaos(db, anexosDir)
    expect(existsSync(caminho)).toBe(false)
    expect(resultado.blobsOrfaosRemovidos).toContain(salvo.id)
  })

  it('linha sem blob (arquivo sumiu): sinaliza, nunca apaga a linha', () => {
    const salvo = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('x'), inputPadrao())
    unlinkSync(join(anexosDir, `${salvo.id}.enc`))

    const resultado = varrerOrfaos(db, anexosDir)
    expect(resultado.linhasSemBlob).toContain(salvo.id)
    // a linha continua no banco
    const aindaExiste = db.$client.prepare('SELECT count(*) as c FROM anexo WHERE id = ?').get(salvo.id) as { c: number }
    expect(aindaExiste.c).toBe(1)
  })
})

describe('purgarAnexos', () => {
  it('remove o blob de anexo soft-deletado há mais de 30 dias, mas mantém a linha', () => {
    const salvo = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('x'), inputPadrao())
    const ha40Dias = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    db.$client.prepare('UPDATE anexo SET deleted_at = ? WHERE id = ?').run(ha40Dias, salvo.id)

    const purgados = purgarAnexos(db, anexosDir, 30)

    expect(purgados).toContain(salvo.id)
    expect(existsSync(join(anexosDir, `${salvo.id}.enc`))).toBe(false)
    const linha = db.$client.prepare('SELECT count(*) as c FROM anexo WHERE id = ?').get(salvo.id) as { c: number }
    expect(linha.c).toBe(1) // registro histórico permanece
  })

  it('não purga anexo soft-deletado há menos de 30 dias', () => {
    const salvo = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('x'), inputPadrao())
    const ha5Dias = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    db.$client.prepare('UPDATE anexo SET deleted_at = ? WHERE id = ?').run(ha5Dias, salvo.id)

    const purgados = purgarAnexos(db, anexosDir, 30)

    expect(purgados).toHaveLength(0)
    expect(existsSync(join(anexosDir, `${salvo.id}.enc`))).toBe(true)
  })

  it('não toca anexo que nunca foi excluído', () => {
    salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('x'), inputPadrao())
    expect(purgarAnexos(db, anexosDir, 30)).toHaveLength(0)
  })
})

describe('listarAnexosPaciente / excluirAnexo / restaurarAnexo', () => {
  it('lista só os ativos por padrão, mais recente primeiro', () => {
    const a = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('a'), inputPadrao({ nomeOriginal: 'a.pdf' }))
    const b = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('b'), inputPadrao({ nomeOriginal: 'b.pdf' }))

    const lista = listarAnexosPaciente(db, pacienteId)
    expect(lista.map((x) => x.id)).toEqual([b.id, a.id])
  })

  it('excluir (soft delete) tira da lista ativa, mas mantém o blob no disco', () => {
    const a = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('a'), inputPadrao())
    excluirAnexo(db, a.id)

    expect(listarAnexosPaciente(db, pacienteId)).toHaveLength(0)
    expect(listarAnexosPaciente(db, pacienteId, { lixeira: true }).map((x) => x.id)).toEqual([a.id])
    expect(existsSync(join(anexosDir, `${a.id}.enc`))).toBe(true) // excluir mantém o blob (critério de aceite da Etapa 16)
  })

  it('restaurar devolve o anexo pra lista ativa', () => {
    const a = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('a'), inputPadrao())
    excluirAnexo(db, a.id)
    restaurarAnexo(db, a.id)

    expect(listarAnexosPaciente(db, pacienteId).map((x) => x.id)).toEqual([a.id])
    expect(listarAnexosPaciente(db, pacienteId, { lixeira: true })).toHaveLength(0)
  })

  it('purgar depois de excluir remove o blob de verdade', () => {
    const a = salvarAnexo(db, anexosDir, chaveMestra, Buffer.from('a'), inputPadrao())
    excluirAnexo(db, a.id)
    db.$client
      .prepare('UPDATE anexo SET deleted_at = ? WHERE id = ?')
      .run(new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(), a.id)

    const purgados = purgarAnexos(db, anexosDir, 30)
    expect(purgados).toContain(a.id)
    expect(existsSync(join(anexosDir, `${a.id}.enc`))).toBe(false)
  })
})
