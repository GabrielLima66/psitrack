import { randomBytes } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { createKeysFile, writeKeysFile } from '../crypto/envelope'
import { openDatabase, type PsiTrackDatabase } from '../db/connection'
import { runMigrations } from '../db/migrate'
import { criarPaciente } from '../db/repositories/pacientes'
import { createTempDbPath } from '../db/test-support'
import { gravarConfig } from './destinos'
import { criarBackupManual } from './gerenciador'
import { lerHistorico, type ExecucaoBackupAutomatico } from './historico'
import { readManifest, writeManifest } from './manifest'
import {
  definirBaselineEscritas,
  deveExecutarBackupAutomatico,
  dispararBackupAutomaticoSeNecessario,
  houveEscritaNaSessao,
  marcarBackupAutomaticoConcluido,
  marcarBackupAutomaticoIniciado,
  totalChangesAtual
} from './scheduler'

const MIGRATIONS_FOLDER = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'db', 'migrations')

let cleanup: (() => void) | undefined
let openDbs: PsiTrackDatabase[] = []

afterEach(() => {
  for (const db of openDbs) db.$client.close()
  openDbs = []
  cleanup?.()
  cleanup = undefined
  marcarBackupAutomaticoConcluido() // garante que nenhum teste deixa a flag "presa" pro próximo
  definirBaselineEscritas(0) // idem pra baseline — scheduler.ts guarda os dois em módulo singleton, vaza entre testes senão
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
  const historicoPath = join(temp.dir, 'historico-automatico.json')

  return { temp, dek, db, keysFilePath, anexosDir, backupDir, configPath, historicoPath }
}

describe('deveExecutarBackupAutomatico', () => {
  it('sem nenhum backup ainda, deve executar', async () => {
    const { backupDir } = await ambiente()
    expect(deveExecutarBackupAutomatico(backupDir)).toBe(true)
  })

  it('com um backup recente (menos de 24h), não deve executar de novo', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })
    criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })

    expect(deveExecutarBackupAutomatico(backupDir)).toBe(false)
  })

  it('com o backup mais recente tendo mais de 24h, deve executar (critério "após 48h")', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })
    const backup = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })

    const manifestPath = join(backupDir, backup.pasta, 'manifest.json')
    const manifest = readManifest(manifestPath)
    const haDoisDias = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    writeManifest(manifestPath, { ...manifest, createdAt: haDoisDias })

    expect(deveExecutarBackupAutomatico(backupDir)).toBe(true)
  })
})

describe('houveEscritaNaSessao', () => {
  it('nenhuma escrita desde a baseline: false (mesmo com migração/materialização já tendo escrito antes da baseline)', async () => {
    const { db } = await ambiente()
    const baseline = totalChangesAtual(db) // captura pós-migração, como vault.ts faria
    expect(houveEscritaNaSessao(db, baseline)).toBe(false)
  })

  it('depois de um insert além da baseline: true', async () => {
    const { db } = await ambiente()
    const baseline = totalChangesAtual(db)
    criarPaciente(db, { nome: 'Paciente Teste' })
    expect(houveEscritaNaSessao(db, baseline)).toBe(true)
  })
})

describe('dispararBackupAutomaticoSeNecessario', () => {
  it('não dispara se já há um backup automático em andamento', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir, configPath, historicoPath } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })

    marcarBackupAutomaticoIniciado()
    const chamadas: ExecucaoBackupAutomatico[] = []
    const disparou = dispararBackupAutomaticoSeNecessario({
      db, dek, backupDir, anexosDir, keysFilePath, configPath, historicoPath,
      gatilho: 'destrancar', exigirEscritaNaSessao: false, onResultado: (e) => chamadas.push(e)
    })

    expect(disparou).toBe(false)
    expect(chamadas).toHaveLength(0)
  })

  it('não dispara se a política de "no máximo um por dia" ainda não permite', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir, configPath, historicoPath } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })
    criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath }) // já existe um backup recente

    const disparou = dispararBackupAutomaticoSeNecessario({
      db, dek, backupDir, anexosDir, keysFilePath, configPath, historicoPath,
      gatilho: 'destrancar', exigirEscritaNaSessao: false, onResultado: () => {}
    })

    expect(disparou).toBe(false)
  })

  it('gatilho "fechar" com exigirEscritaNaSessao e nenhuma escrita além da baseline: não dispara', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir, configPath, historicoPath } = await ambiente()
    definirBaselineEscritas(totalChangesAtual(db)) // mesmo passo que vault.ts faria pós-unlock
    // paciente NÃO criado — nenhuma escrita além da baseline nesta sessão.

    const disparou = dispararBackupAutomaticoSeNecessario({
      db, dek, backupDir, anexosDir, keysFilePath, configPath, historicoPath,
      gatilho: 'fechar', exigirEscritaNaSessao: true, onResultado: () => {}
    })

    expect(disparou).toBe(false)
  })

  it('gatilho "fechar" com escrita além da baseline: dispara', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir, configPath, historicoPath } = await ambiente()
    definirBaselineEscritas(totalChangesAtual(db))
    criarPaciente(db, { nome: 'Paciente Teste' }) // escrita real da usuária, além da baseline

    const chamadas: ExecucaoBackupAutomatico[] = []
    const disparou = dispararBackupAutomaticoSeNecessario({
      db, dek, backupDir, anexosDir, keysFilePath, configPath, historicoPath,
      gatilho: 'fechar', exigirEscritaNaSessao: true, onResultado: (e) => chamadas.push(e)
    })

    expect(disparou).toBe(true)
    expect(chamadas[0]).toMatchObject({ gatilho: 'fechar', localOk: true })
  })

  it('dispara, grava no histórico e chama onResultado quando não há destino configurado', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir, configPath, historicoPath } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })

    const chamadas: ExecucaoBackupAutomatico[] = []
    const disparou = dispararBackupAutomaticoSeNecessario({
      db, dek, backupDir, anexosDir, keysFilePath, configPath, historicoPath,
      gatilho: 'destrancar', exigirEscritaNaSessao: false, onResultado: (e) => chamadas.push(e)
    })

    expect(disparou).toBe(true)
    expect(chamadas).toHaveLength(1)
    expect(chamadas[0]).toMatchObject({ gatilho: 'destrancar', localOk: true, destinoOk: null })
    expect(lerHistorico(historicoPath)).toHaveLength(1)
  })

  it('destino configurado mas inválido: sucesso parcial (localOk true, destinoOk false), não lança', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir, configPath, historicoPath } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })
    const arquivoNoLugarDePasta = join(pastaVazia(), 'nao-e-pasta.txt')
    writeFileSync(arquivoNoLugarDePasta, 'isto não é uma pasta de destino')
    gravarConfig(configPath, { destinoBackupExterno: arquivoNoLugarDePasta, ultimoBackupExternoEm: null })

    const chamadas: ExecucaoBackupAutomatico[] = []
    dispararBackupAutomaticoSeNecessario({
      db, dek, backupDir, anexosDir, keysFilePath, configPath, historicoPath,
      gatilho: 'destrancar', exigirEscritaNaSessao: false, onResultado: (e) => chamadas.push(e)
    })

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0]!.localOk).toBe(true)
    expect(chamadas[0]!.destinoOk).toBe(false)
    expect(chamadas[0]!.erro).toBeTruthy()
  })

  it('falha total (keys.json ausente): registra localOk false no histórico, não lança pra fora', async () => {
    const { db, dek, anexosDir, backupDir, configPath, historicoPath } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })
    const keysFilePathInexistente = join(pastaVazia(), 'keys-que-nao-existe.json')

    const chamadas: ExecucaoBackupAutomatico[] = []
    expect(() =>
      dispararBackupAutomaticoSeNecessario({
        db,
        dek,
        backupDir,
        anexosDir,
        keysFilePath: keysFilePathInexistente,
        configPath,
        historicoPath,
        gatilho: 'destrancar',
        exigirEscritaNaSessao: false,
        onResultado: (e) => chamadas.push(e)
      })
    ).not.toThrow()

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0]!.localOk).toBe(false)
    expect(chamadas[0]!.erro).toBeTruthy()
    expect(lerHistorico(historicoPath)).toHaveLength(1)
  })
})
