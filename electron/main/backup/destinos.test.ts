import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { salvarAnexo } from '../anexos/anexoStore'
import { createKeysFile, writeKeysFile } from '../crypto/envelope'
import { openDatabase, type PsiTrackDatabase } from '../db/connection'
import { runMigrations } from '../db/migrate'
import { criarPaciente } from '../db/repositories/pacientes'
import { createTempDbPath } from '../db/test-support'
import {
  copiarParaPool,
  criarBackupComDestino,
  gravarConfig,
  lerConfig,
  validarDestino,
  verificarPool,
  verificarSnapshotExterno
} from './destinos'
import { getRowCounts, verificarIntegridadeArquivo } from './verify'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'db', 'migrations')

let cleanup: (() => void) | undefined
let openDbs: PsiTrackDatabase[] = []

afterEach(() => {
  for (const db of openDbs) db.$client.close()
  openDbs = []
  cleanup?.()
  cleanup = undefined
})

function pastaVazia(prefixo = 'psitrack-'): string {
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

  const anexosDir = pastaVazia('psitrack-anexos-')
  const backupDir = join(temp.dir, 'backups')
  const configPath = join(temp.dir, 'config.json')
  const userDataDir = temp.dir

  return { temp, dek, db, keysFilePath, anexosDir, backupDir, configPath, userDataDir }
}

describe('config.json', () => {
  it('sem arquivo ainda, devolve os valores padrão', () => {
    const configPath = join(pastaVazia(), 'config.json')
    expect(lerConfig(configPath)).toEqual({ destinoBackupExterno: null, ultimoBackupExternoEm: null })
  })

  it('grava e lê de volta', () => {
    const configPath = join(pastaVazia(), 'config.json')
    const config = { destinoBackupExterno: 'D:\\backup', ultimoBackupExternoEm: '2026-08-01T00:00:00.000Z' }
    gravarConfig(configPath, config)
    expect(lerConfig(configPath)).toEqual(config)
  })
})

describe('validarDestino', () => {
  it('bloqueia destino igual ao userData', () => {
    expect(() => validarDestino('C:\\Users\\ana\\AppData\\Roaming\\PsiTrack', 'C:\\Users\\ana\\AppData\\Roaming\\PsiTrack')).toThrow(
      /dados do próprio app/i
    )
  })

  it('bloqueia destino dentro do userData', () => {
    expect(() =>
      validarDestino('C:\\Users\\ana\\AppData\\Roaming\\PsiTrack\\backups', 'C:\\Users\\ana\\AppData\\Roaming\\PsiTrack')
    ).toThrow(/dados do próprio app/i)
  })

  it('permite pasta fora do userData', () => {
    expect(() => validarDestino('D:\\backup-psitrack', 'C:\\Users\\ana\\AppData\\Roaming\\PsiTrack')).not.toThrow()
  })
})

describe('copiarParaPool / verificarPool', () => {
  it('dois blobs com o mesmo sha256 gravam um arquivo só no pool (D38)', () => {
    const anexosDir = pastaVazia('psitrack-anexos-')
    const destino = pastaVazia('psitrack-destino-')
    writeFileSync(join(anexosDir, 'id-a.enc'), 'conteudo-identico')
    writeFileSync(join(anexosDir, 'id-b.enc'), 'conteudo-identico') // mesmo conteúdo, id diferente

    const shaCompartilhado = 'sha-compartilhado'
    copiarParaPool(anexosDir, destino, [
      { id: 'id-a', sha256Cifrado: shaCompartilhado, tamanhoBytes: 'conteudo-identico'.length - 16 },
      { id: 'id-b', sha256Cifrado: shaCompartilhado, tamanhoBytes: 'conteudo-identico'.length - 16 }
    ])

    const arquivosNoPool = readdirSync(join(destino, 'psitrack', 'blobs'))
    expect(arquivosNoPool).toEqual([`${shaCompartilhado}.enc`])
  })

  it('lança se a origem do blob estiver ausente', () => {
    const anexosDir = pastaVazia('psitrack-anexos-')
    const destino = pastaVazia('psitrack-destino-')
    expect(() => copiarParaPool(anexosDir, destino, [{ id: 'inexistente', sha256Cifrado: 'sha', tamanhoBytes: 10 }])).toThrow(
      /ausente/i
    )
  })

  it('verificarPool aponta arquivo ausente, tamanho errado e hash divergente', () => {
    const destino = pastaVazia('psitrack-destino-')
    const anexosDir = pastaVazia('psitrack-anexos-')
    writeFileSync(join(anexosDir, 'ok.enc'), 'x'.repeat(20))
    copiarParaPool(anexosDir, destino, [{ id: 'ok', sha256Cifrado: 'sha-tamanho-errado', tamanhoBytes: 100 }])

    const resultado = verificarPool(
      [
        { id: 'ok', sha256Cifrado: 'sha-tamanho-errado', tamanhoBytes: 100 }, // tamanho esperado 116, real é 20
        { id: 'faltando', sha256Cifrado: 'sha-que-nunca-foi-copiado', tamanhoBytes: 1 }
      ],
      destino
    )

    expect(resultado.ok).toBe(false)
    expect(resultado.problemas).toHaveLength(2)
    expect(resultado.problemas.some((p) => p.includes('tamanho'))).toBe(true)
    expect(resultado.problemas.some((p) => p.includes('ausente'))).toBe(true)
  })
})

describe('criarBackupComDestino', () => {
  it('sem destino configurado: destinoOk é null, backup local é criado normalmente', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir, configPath } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })

    const resultado = criarBackupComDestino({ db, dek, backupDir, anexosDir, keysFilePath, configPath })

    expect(resultado.destinoOk).toBeNull()
    expect(existsSync(join(backupDir, resultado.backup.pasta, 'snapshot.db'))).toBe(true)
  })

  it('destino válido: destinoOk true, dois backups seguidos não duplicam o mesmo blob no pool', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir, configPath } = await ambiente()
    const pacienteId = criarPaciente(db, { nome: 'Paciente Com Anexo' }).id
    const anexo = salvarAnexo(db, anexosDir, dek, Buffer.from('laudo em pdf'), {
      pacienteId,
      classificacao: 'prontuario',
      nomeOriginal: 'laudo.pdf',
      mime: 'application/pdf'
    })

    const destino = pastaVazia('psitrack-destino-')
    gravarConfig(configPath, { destinoBackupExterno: destino, ultimoBackupExternoEm: null })

    const primeiro = criarBackupComDestino({ db, dek, backupDir, anexosDir, keysFilePath, configPath })
    expect(primeiro.destinoOk).toBe(true)
    const configAposPrimeiro = lerConfig(configPath)
    expect(configAposPrimeiro.ultimoBackupExternoEm).not.toBeNull()

    await new Promise((r) => setTimeout(r, 5))
    const segundo = criarBackupComDestino({ db, dek, backupDir, anexosDir, keysFilePath, configPath })
    expect(segundo.destinoOk).toBe(true)

    const blobsNoPool = readdirSync(join(destino, 'psitrack', 'blobs'))
    expect(blobsNoPool).toEqual([`${anexo.sha256Cifrado}.enc`]) // um só, mesmo com dois backups
  })

  it('destino inacessível: destinoOk false, não lança, backup local continua íntegro', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir, configPath } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })

    const arquivoNoLugarDePasta = join(pastaVazia('psitrack-'), 'nao-e-uma-pasta.txt')
    writeFileSync(arquivoNoLugarDePasta, 'isto é um arquivo, não uma pasta de destino')
    gravarConfig(configPath, { destinoBackupExterno: arquivoNoLugarDePasta, ultimoBackupExternoEm: null })

    const resultado = criarBackupComDestino({ db, dek, backupDir, anexosDir, keysFilePath, configPath })

    expect(resultado.destinoOk).toBe(false)
    expect(resultado.destinoErro).toBeTruthy()
    expect(existsSync(join(backupDir, resultado.backup.pasta, 'snapshot.db'))).toBe(true) // local intacto
  })
})

describe('verificarSnapshotExterno', () => {
  it('sem nenhum snapshot externo ainda, devolve null', () => {
    const destino = pastaVazia('psitrack-destino-')
    expect(verificarSnapshotExterno(destino, randomBytes(32))).toBeNull()
  })

  it('com um snapshot externo íntegro, devolve ok:true; blob removido do pool depois faz falhar', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir, configPath } = await ambiente()
    const pacienteId = criarPaciente(db, { nome: 'Paciente Com Anexo' }).id
    const anexo = salvarAnexo(db, anexosDir, dek, Buffer.from('laudo'), {
      pacienteId,
      classificacao: 'prontuario',
      nomeOriginal: 'laudo.pdf',
      mime: 'application/pdf'
    })

    const destino = pastaVazia('psitrack-destino-')
    gravarConfig(configPath, { destinoBackupExterno: destino, ultimoBackupExternoEm: null })
    criarBackupComDestino({ db, dek, backupDir, anexosDir, keysFilePath, configPath })

    expect(verificarSnapshotExterno(destino, dek)?.ok).toBe(true)

    unlinkSync(join(destino, 'psitrack', 'blobs', `${anexo.sha256Cifrado}.enc`))
    expect(verificarSnapshotExterno(destino, dek)?.ok).toBe(false)
  })
})

describe('verificarIntegridadeArquivo (verify.ts, extraída na Etapa 19)', () => {
  it('confere integridade, cifra e contagem de linhas — bate quando a contagem fonte é a certa, falha quando não é', async () => {
    const { db, dek, backupDir } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })
    mkdirSync(backupDir, { recursive: true })
    const dbPath = join(backupDir, 'snapshot.db')
    db.$client.prepare('VACUUM INTO ?').run(dbPath)

    const rowCountsFonte = getRowCounts(db.$client)
    const ok = verificarIntegridadeArquivo(dbPath, dek, rowCountsFonte)
    expect(ok.integrityCheck).toBe('ok')
    expect(ok.cipherIntegrityCheckOk).toBe(true)
    expect(ok.rowCounts.pacientes).toBe(1)
    expect(ok.rowCountsMatchSource).toBe(true)

    const divergente = verificarIntegridadeArquivo(dbPath, dek, { ...rowCountsFonte, pacientes: 999 })
    expect(divergente.rowCountsMatchSource).toBe(false)
  })
})
