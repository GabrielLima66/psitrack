import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { excluirAnexo, salvarAnexo } from '../anexos/anexoStore'
import { createKeysFile, writeKeysFile } from '../crypto/envelope'
import { openDatabase, type PsiTrackDatabase } from '../db/connection'
import { runMigrations } from '../db/migrate'
import { arquivarPaciente, criarPaciente } from '../db/repositories/pacientes'
import { anexo, pacientes } from '../db/schema'
import { createTempDbPath } from '../db/test-support'
import { criarBackupManual, listarBackups, restaurarBackupComSeguranca, verificarBackup } from './gerenciador'
import { writeManifest } from './manifest'
import { lerUltimaRestauracao } from './registroRestauracao'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'db', 'migrations')

let cleanup: (() => void) | undefined
let openDbs: PsiTrackDatabase[] = []

afterEach(() => {
  for (const db of openDbs) db.$client.close()
  openDbs = []
  cleanup?.()
  cleanup = undefined
})

function pastaVazia(prefixo = 'psitrack-anexos-'): string {
  return mkdtempSync(join(tmpdir(), prefixo))
}

async function ambiente() {
  const temp = createTempDbPath()
  cleanup = temp.cleanup
  const dek = randomBytes(32)

  const db = openDatabase({ filePath: temp.filePath, dek })
  openDbs.push(db)
  runMigrations(db, MIGRATIONS_FOLDER)

  const { keysFile } = await createKeysFile('senha-teste')
  const keysFilePath = join(temp.dir, 'keys.json')
  writeKeysFile(keysFilePath, keysFile)

  const anexosDir = pastaVazia()
  const backupDir = join(temp.dir, 'backups')

  return { temp, dek, db, keysFilePath, anexosDir, backupDir }
}

describe('criarBackupManual', () => {
  it('grava snapshot.db, manifest.json, keys.json e anexos/ dentro de uma pasta backup-<timestamp>', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })

    const backup = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })

    expect(backup.origem).toBe('manual')
    expect(backup.pasta.startsWith('backup-')).toBe(true)
    const pastaCompleta = join(backupDir, backup.pasta)
    expect(existsSync(join(pastaCompleta, 'snapshot.db'))).toBe(true)
    expect(existsSync(join(pastaCompleta, 'manifest.json'))).toBe(true)
    expect(existsSync(join(pastaCompleta, 'keys.json'))).toBe(true)
    expect(existsSync(join(pastaCompleta, 'anexos'))).toBe(true)
    expect(backup.tamanhoBytes).toBeGreaterThan(0)
    expect(backup.manifest.verification.ok).toBe(true)
  })
})

describe('listarBackups', () => {
  it('backupDir inexistente devolve lista vazia', () => {
    expect(listarBackups(join(tmpdir(), 'psitrack-backups-que-nao-existe'))).toEqual([])
  })

  it('lista ordenada por data decrescente, ignorando subpasta sem manifest.json', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })

    const primeiro = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })
    await new Promise((r) => setTimeout(r, 5)) // garante createdAt diferente entre os dois
    const segundo = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })

    // Simula um snapshot pré-migração (Etapa 9) convivendo na mesma backupDir — sem manifest.json de propósito.
    mkdirSync(join(backupDir, 'pre-migration-v5-123456'), { recursive: true })

    const lista = listarBackups(backupDir)

    expect(lista.map((b) => b.pasta)).toEqual([segundo.pasta, primeiro.pasta])
  })
})

describe('verificarBackup', () => {
  it('backup íntegro com anexo verifica ok', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir } = await ambiente()
    const pacienteId = criarPaciente(db, { nome: 'Paciente Com Anexo' }).id
    salvarAnexo(db, anexosDir, dek, Buffer.from('laudo'), {
      pacienteId,
      classificacao: 'prontuario',
      nomeOriginal: 'laudo.pdf',
      mime: 'application/pdf'
    })

    const backup = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })
    const resultado = verificarBackup(backupDir, backup.pasta, dek)

    expect(resultado.ok).toBe(true)
    expect(resultado.blobs.ok).toBe(true)
  })

  it('blob removido do backup depois do fato faz a verificação falhar apontando o id', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir } = await ambiente()
    const pacienteId = criarPaciente(db, { nome: 'Paciente Com Anexo' }).id
    const anexo = salvarAnexo(db, anexosDir, dek, Buffer.from('laudo'), {
      pacienteId,
      classificacao: 'prontuario',
      nomeOriginal: 'laudo.pdf',
      mime: 'application/pdf'
    })

    const backup = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })
    unlinkSync(join(backupDir, backup.pasta, 'anexos', `${anexo.id}.enc`))

    const resultado = verificarBackup(backupDir, backup.pasta, dek)

    expect(resultado.ok).toBe(false)
    expect(resultado.blobs.problemas[0]).toContain(anexo.id)
  })
})

describe('restaurarBackupComSeguranca', () => {
  it('ciclo completo: paciente arquivado e anexo excluído voltam ao estado do backup', async () => {
    const { temp, db, dek, keysFilePath, anexosDir, backupDir } = await ambiente()
    const paciente = criarPaciente(db, { nome: 'Paciente Recuperável' })
    const anexoSalvo = salvarAnexo(db, anexosDir, dek, Buffer.from('laudo importante'), {
      pacienteId: paciente.id,
      classificacao: 'prontuario',
      nomeOriginal: 'laudo.pdf',
      mime: 'application/pdf'
    })

    const backup = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })

    // Muta o estado "atual" depois do backup — é isso que o restore precisa desfazer.
    arquivarPaciente(db, paciente.id)
    excluirAnexo(db, anexoSalvo.id)

    let fechou = false
    const resultado = restaurarBackupComSeguranca({
      db,
      dek,
      backupDir,
      pasta: backup.pasta,
      anexosDirAtual: anexosDir,
      keysFilePathAtual: keysFilePath,
      dbPathAtual: temp.filePath,
      migrationsFolder: MIGRATIONS_FOLDER,
      fecharConexaoAtual: () => {
        fechou = true
        db.$client.close()
        openDbs = openDbs.filter((d) => d !== db)
      }
    })

    expect(fechou).toBe(true)
    expect(resultado.safetyBackup.origem).toBe('pre-restore')
    expect(resultado.safetyBackup.manifest.verification.ok).toBe(true)
    expect(listarBackups(backupDir).some((b) => b.pasta === resultado.safetyBackup.pasta)).toBe(true)

    const restaurado = openDatabase({ filePath: temp.filePath, dek })
    openDbs.push(restaurado)
    const linhaPaciente = restaurado.select().from(pacientes).all().find((p) => p.id === paciente.id)
    expect(linhaPaciente?.deletedAt).toBeNull()

    const linhaAnexo = restaurado.select().from(anexo).all().find((a) => a.id === anexoSalvo.id)
    expect(linhaAnexo?.deletedAt).toBeNull()

    expect(readdirSync(anexosDir)).toContain(`${anexoSalvo.id}.enc`)
    expect(lerUltimaRestauracao(backupDir)).toEqual({ restauradoEm: expect.any(String), pastaOrigem: backup.pasta })
  })

  it('gate de versão bloqueando nunca fecha a conexão nem toca no banco alvo', async () => {
    const { temp, db, dek, keysFilePath, anexosDir, backupDir } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })

    const backup = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })
    const manifestPath = join(backupDir, backup.pasta, 'manifest.json')
    writeManifest(manifestPath, { ...backup.manifest, schemaVersion: 99 })

    let fechou = false
    expect(() =>
      restaurarBackupComSeguranca({
        db,
        dek,
        backupDir,
        pasta: backup.pasta,
        anexosDirAtual: anexosDir,
        keysFilePathAtual: keysFilePath,
        dbPathAtual: temp.filePath,
        migrationsFolder: MIGRATIONS_FOLDER,
        fecharConexaoAtual: () => {
          fechou = true
        }
      })
    ).toThrow(/vers.o mais nova/i)

    expect(fechou).toBe(false)
  })
})
