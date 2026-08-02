import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { salvarAnexo } from '../anexos/anexoStore'
import { openDatabase, type PsiTrackDatabase } from '../db/connection'
import { runMigrations } from '../db/migrate'
import { criarPaciente } from '../db/repositories/pacientes'
import { createTempDbPath } from '../db/test-support'
import { copiarBlobs, listarBlobsParaManifesto, verificarBlobs } from './blobs'

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

function salvarUmAnexo(conteudo: string) {
  return salvarAnexo(db, anexosDir, chaveMestra, Buffer.from(conteudo), {
    pacienteId,
    classificacao: 'prontuario',
    nomeOriginal: 'laudo.pdf',
    mime: 'application/pdf'
  })
}

describe('listarBlobsParaManifesto', () => {
  it('lista id, sha256Cifrado e tamanhoBytes de cada anexo', () => {
    const a = salvarUmAnexo('primeiro')
    const b = salvarUmAnexo('segundo, um pouco maior')

    const entries = listarBlobsParaManifesto(db)
    expect(entries).toHaveLength(2)
    const ids = entries.map((e) => e.id)
    expect(ids).toContain(a.id)
    expect(ids).toContain(b.id)
    expect(entries.find((e) => e.id === a.id)?.sha256Cifrado).toBe(a.sha256Cifrado)
  })
})

describe('copiarBlobs', () => {
  it('copia cada blob referenciado pra pasta de destino', () => {
    const a = salvarUmAnexo('conteúdo a')
    const entries = listarBlobsParaManifesto(db)
    const destDir = mkdtempSync(join(tmpdir(), 'psitrack-blobs-dest-'))

    copiarBlobs(anexosDir, destDir, entries)

    expect(existsSync(join(destDir, `${a.id}.enc`))).toBe(true)
    expect(readdirSync(destDir)).toHaveLength(1)
  })

  it('lança se um blob referenciado estiver ausente na origem', () => {
    const entries: [{ id: string; sha256Cifrado: string; tamanhoBytes: number }] = [
      { id: 'id-que-nao-existe', sha256Cifrado: 'x', tamanhoBytes: 1 }
    ]
    const destDir = mkdtempSync(join(tmpdir(), 'psitrack-blobs-dest-'))
    expect(() => copiarBlobs(anexosDir, destDir, entries)).toThrow(/ausente/)
  })
})

describe('verificarBlobs', () => {
  it('ok quando presença, tamanho e hash batem', () => {
    salvarUmAnexo('conteúdo íntegro')
    const entries = listarBlobsParaManifesto(db)
    const destDir = mkdtempSync(join(tmpdir(), 'psitrack-blobs-dest-'))
    copiarBlobs(anexosDir, destDir, entries)

    expect(verificarBlobs(entries, destDir)).toEqual({ ok: true, problemas: [] })
  })

  it('aponta o id certo quando um blob está ausente', () => {
    const a = salvarUmAnexo('conteúdo a')
    const entries = listarBlobsParaManifesto(db)
    const destDir = mkdtempSync(join(tmpdir(), 'psitrack-blobs-dest-'))
    copiarBlobs(anexosDir, destDir, entries)
    // remove só o blob de "a" do destino, simulando um backup incompleto/corrompido
    unlinkSync(join(destDir, `${a.id}.enc`))

    const resultado = verificarBlobs(entries, destDir)
    expect(resultado.ok).toBe(false)
    expect(resultado.problemas[0]).toContain(a.id)
    expect(resultado.problemas[0]).toContain('ausente')
  })

  it('aponta divergência de hash quando o conteúdo do blob foi alterado (mesmo tamanho)', () => {
    const a = salvarUmAnexo('conteúdo original')
    const entries = listarBlobsParaManifesto(db)
    const destDir = mkdtempSync(join(tmpdir(), 'psitrack-blobs-dest-'))
    copiarBlobs(anexosDir, destDir, entries)

    const tamanhoNoDisco = entries.find((e) => e.id === a.id)!.tamanhoBytes + 16 // +authTag (GCM)
    writeFileSync(join(destDir, `${a.id}.enc`), Buffer.alloc(tamanhoNoDisco, 'X')) // mesmo tamanho, conteúdo diferente — só o hash pega

    const resultado = verificarBlobs(entries, destDir)
    expect(resultado.ok).toBe(false)
    expect(resultado.problemas[0]).toContain(a.id)
    expect(resultado.problemas[0]).toContain('hash')
  })
})
