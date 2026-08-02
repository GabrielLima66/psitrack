import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { salvarAnexo } from '../anexos/anexoStore'
import { createKeysFile, writeKeysFile } from '../crypto/envelope'
import { openDatabase, type PsiTrackDatabase } from '../db/connection'
import { readSchemaVersion, runMigrations } from '../db/migrate'
import { criarPaciente } from '../db/repositories/pacientes'
import { pacientes, prontuarioEvolucao } from '../db/schema'
import { createTempDbPath } from '../db/test-support'
import { uuidv7 } from '../db/uuidv7'
import { runBackup } from './backup'
import { verificarBlobs } from './blobs'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'db', 'migrations')

let cleanup: (() => void) | undefined
let openDbs: PsiTrackDatabase[] = []

afterEach(() => {
  for (const db of openDbs) db.$client.close()
  openDbs = []
  cleanup?.()
  cleanup = undefined
})

function seedSourceDb(dek: Buffer, dir: string): PsiTrackDatabase {
  const db = openDatabase({ filePath: join(dir, 'source.db'), dek })
  openDbs.push(db)
  runMigrations(db, MIGRATIONS_FOLDER)

  const pacienteId = uuidv7()
  db.insert(pacientes)
    .values({
      id: pacienteId,
      nome: 'Paciente Teste',
      nomeBusca: 'paciente teste',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    .run()
  db.insert(prontuarioEvolucao)
    .values({ id: uuidv7(), pacienteId, conteudo: 'evolução 1', dataSessao: '2026-01-10', createdAt: new Date().toISOString() })
    .run()
  db.insert(prontuarioEvolucao)
    .values({ id: uuidv7(), pacienteId, conteudo: 'evolução 2', dataSessao: '2026-01-12', createdAt: new Date().toISOString() })
    .run()

  return db
}

function pastaVazia(): string {
  return mkdtempSync(join(tmpdir(), 'psitrack-anexos-'))
}

describe('runBackup', () => {
  it('ciclo backup -> reabrir o snapshot preserva contagens de todas as tabelas', async () => {
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)
    const db = seedSourceDb(dek, temp.dir)

    const { keysFile } = await createKeysFile('senha-teste')
    const keysFilePath = join(temp.dir, 'keys.json')
    writeKeysFile(keysFilePath, keysFile)

    const snapshotPath = join(temp.dir, 'backup.db')
    const manifest = runBackup({
      db,
      dek,
      snapshotPath,
      keysFilePath,
      keysFileDestPath: join(temp.dir, 'backup-keys.json'),
      manifestPath: join(temp.dir, 'manifest.json'),
      anexosDir: pastaVazia(),
      blobsDestDir: join(temp.dir, 'backup-anexos')
    })

    expect(manifest.verification.ok).toBe(true)
    expect(manifest.verification.integrityCheck).toBe('ok')
    expect(manifest.verification.cipherIntegrityCheckOk).toBe(true)
    expect(manifest.verification.rowCountsMatchSource).toBe(true)
    expect(manifest.schemaVersion).toBe(readSchemaVersion(MIGRATIONS_FOLDER)) // não hardcoda o nº de migrations — muda a cada fase
    expect(manifest.blobs.total).toBe(0)

    const restored = openDatabase({ filePath: snapshotPath, dek })
    openDbs.push(restored)
    expect(restored.select().from(pacientes).all()).toHaveLength(1)
    expect(restored.select().from(prontuarioEvolucao).all()).toHaveLength(2)
  })

  it('copia o keys.json atual junto do snapshot', async () => {
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)
    const db = seedSourceDb(dek, temp.dir)

    const { keysFile } = await createKeysFile('senha-teste')
    const keysFilePath = join(temp.dir, 'keys.json')
    writeKeysFile(keysFilePath, keysFile)
    const keysFileDestPath = join(temp.dir, 'backup-keys.json')

    runBackup({
      db,
      dek,
      snapshotPath: join(temp.dir, 'backup.db'),
      keysFilePath,
      keysFileDestPath,
      manifestPath: join(temp.dir, 'manifest.json'),
      anexosDir: pastaVazia(),
      blobsDestDir: join(temp.dir, 'backup-anexos')
    })

    expect(readFileSync(keysFileDestPath, 'utf-8')).toBe(readFileSync(keysFilePath, 'utf-8'))
  })

  it('não deixa o .tmp intermediário depois de um backup bem-sucedido', async () => {
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)
    const db = seedSourceDb(dek, temp.dir)

    const { keysFile } = await createKeysFile('senha-teste')
    const keysFilePath = join(temp.dir, 'keys.json')
    writeKeysFile(keysFilePath, keysFile)
    const snapshotPath = join(temp.dir, 'backup.db')

    runBackup({
      db,
      dek,
      snapshotPath,
      keysFilePath,
      keysFileDestPath: join(temp.dir, 'backup-keys.json'),
      manifestPath: join(temp.dir, 'manifest.json'),
      anexosDir: pastaVazia(),
      blobsDestDir: join(temp.dir, 'backup-anexos')
    })

    expect(existsSync(`${snapshotPath}.tmp`)).toBe(false)
    expect(existsSync(snapshotPath)).toBe(true)
  })

  it('banco com 5 anexos produz manifesto com 5 entradas e 5 arquivos (SPEC-fase-3.md)', async () => {
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)
    const db = seedSourceDb(dek, temp.dir)
    const pacienteId = criarPaciente(db, { nome: 'Outro Paciente' }).id
    const anexosDir = pastaVazia()

    for (let i = 0; i < 5; i++) {
      salvarAnexo(db, anexosDir, dek, Buffer.from(`conteúdo do anexo ${i}`), {
        pacienteId,
        classificacao: 'prontuario',
        nomeOriginal: `documento-${i}.pdf`,
        mime: 'application/pdf'
      })
    }

    const { keysFile } = await createKeysFile('senha-teste')
    const keysFilePath = join(temp.dir, 'keys.json')
    writeKeysFile(keysFilePath, keysFile)
    const blobsDestDir = join(temp.dir, 'backup-anexos')

    const manifest = runBackup({
      db,
      dek,
      snapshotPath: join(temp.dir, 'backup.db'),
      keysFilePath,
      keysFileDestPath: join(temp.dir, 'backup-keys.json'),
      manifestPath: join(temp.dir, 'manifest.json'),
      anexosDir,
      blobsDestDir
    })

    expect(manifest.blobs.total).toBe(5)
    expect(manifest.blobs.entries).toHaveLength(5)
    expect(readdirSync(blobsDestDir)).toHaveLength(5)
  })

  it('remover um blob do backup faz a verificação de blobs falhar apontando qual', async () => {
    const temp = createTempDbPath()
    cleanup = temp.cleanup
    const dek = randomBytes(32)
    const db = seedSourceDb(dek, temp.dir)
    const pacienteId = criarPaciente(db, { nome: 'Paciente Com Anexo' }).id
    const anexosDir = pastaVazia()
    const anexo = salvarAnexo(db, anexosDir, dek, Buffer.from('laudo importante'), {
      pacienteId,
      classificacao: 'prontuario',
      nomeOriginal: 'laudo.pdf',
      mime: 'application/pdf'
    })

    const { keysFile } = await createKeysFile('senha-teste')
    const keysFilePath = join(temp.dir, 'keys.json')
    writeKeysFile(keysFilePath, keysFile)
    const blobsDestDir = join(temp.dir, 'backup-anexos')

    const manifest = runBackup({
      db,
      dek,
      snapshotPath: join(temp.dir, 'backup.db'),
      keysFilePath,
      keysFileDestPath: join(temp.dir, 'backup-keys.json'),
      manifestPath: join(temp.dir, 'manifest.json'),
      anexosDir,
      blobsDestDir
    })
    expect(manifest.verification.blobs.ok).toBe(true)

    unlinkSync(join(blobsDestDir, `${anexo.id}.enc`))

    const reVerificacao = verificarBlobs(manifest.blobs.entries, blobsDestDir)
    expect(reVerificacao.ok).toBe(false)
    expect(reVerificacao.problemas[0]).toContain(anexo.id)
  })
})
