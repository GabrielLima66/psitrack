import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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
import type { BlobManifestEntry } from './blobs'
import { escreverBackupExterno, listarSnapshotsExternos, pastaPool, pastaSnapshots } from './destinos'
import { criarBackupManual, listarBackups } from './gerenciador'
import { readManifest, writeManifest } from './manifest'
import { calcularRetencao, executarPurga, previewPurga, type ItemRetencao } from './retencao'
import { getRowCounts } from './verify'

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

function haDiasAtras(dias: number): string {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString()
}

function haMesesAtras(meses: number): string {
  const d = new Date()
  d.setUTCMonth(d.getUTCMonth() - meses)
  return d.toISOString()
}

function reescreverCreatedAt(manifestPath: string, novoCreatedAt: string): void {
  const manifest = readManifest(manifestPath)
  writeManifest(manifestPath, { ...manifest, createdAt: novoCreatedAt })
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

  return { temp, dek, db, keysFilePath, anexosDir, backupDir }
}

describe('calcularRetencao (GFS 7 diários + 4 semanais + 6 mensais, D39)', () => {
  it('backups diários o suficiente convergem pra exatamente 17 retidos (7+4+6)', () => {
    // Não dá pra usar 90 dias aqui: 7 diários + 4 semanais já consomem ~35
    // dias reais, sobrando só ~55 dias (menos de 2 meses-calendário) pra
    // camada mensal — nunca o suficiente pra achar 6 meses distintos (6
    // meses de histórico não existem se só houve 90 dias de backup no
    // total). 240 dias garante os 6 meses distintos além da janela
    // diária+semanal, com folga pra qualquer alinhamento de calendário.
    const itens: ItemRetencao[] = []
    for (let d = 0; d < 240; d++) {
      itens.push({ identificador: `backup-${d}`, createdAt: haDiasAtras(d) })
    }
    const decisao = calcularRetencao(itens)
    expect(decisao.manter).toHaveLength(17)
    expect(decisao.purgar).toHaveLength(223)
  })

  it('lista vazia não lança e devolve tudo vazio', () => {
    expect(calcularRetencao([])).toEqual({ manter: [], purgar: [] })
  })

  it('um item só é sempre retido', () => {
    const decisao = calcularRetencao([{ identificador: 'unico', createdAt: haDiasAtras(0) }])
    expect(decisao.manter).toEqual(['unico'])
  })

  it('duas entradas no mesmo dia: só a mais recente fica, a outra é purgável', () => {
    const mesmoIso = haDiasAtras(0)
    const decisao = calcularRetencao([
      { identificador: 'mais-antiga', createdAt: mesmoIso },
      { identificador: 'mais-nova', createdAt: new Date(new Date(mesmoIso).getTime() + 1000).toISOString() }
    ])
    expect(decisao.manter).toEqual(['mais-nova'])
    expect(decisao.purgar).toEqual(['mais-antiga'])
  })
})

describe('executarPurga', () => {
  it('purga local: retém o mais recente do dia, apaga de disco a duplicata mais antiga do mesmo dia', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })

    const antigo = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })
    reescreverCreatedAt(join(backupDir, antigo.pasta, 'manifest.json'), haDiasAtras(0))
    await new Promise((r) => setTimeout(r, 5))
    const novo = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })
    reescreverCreatedAt(join(backupDir, novo.pasta, 'manifest.json'), haDiasAtras(0))

    const resultado = executarPurga({ backupDir, destino: null, dek })

    expect(resultado.local.manter).toEqual([novo.pasta])
    expect(resultado.local.purgar).toEqual([antigo.pasta])
    expect(resultado.externo).toBeNull()
    expect(existsSync(join(backupDir, antigo.pasta))).toBe(false)
    expect(existsSync(join(backupDir, novo.pasta))).toBe(true)
  })

  it('blob referenciado por snapshot mensal antigo não é purgado quando os diários/semanais caem, mas some quando NADA mais o referencia', async () => {
    const { db, dek, anexosDir, backupDir } = await ambiente()
    const pacienteId = criarPaciente(db, { nome: 'Paciente Com Anexo Antigo' }).id
    const anexo = salvarAnexo(db, anexosDir, dek, Buffer.from('conteúdo exclusivo deste anexo antigo'), {
      pacienteId,
      classificacao: 'prontuario',
      nomeOriginal: 'laudo-antigo.pdf',
      mime: 'application/pdf'
    })
    const entryAnexo: BlobManifestEntry = { id: anexo.id, sha256Cifrado: anexo.sha256Cifrado, tamanhoBytes: anexo.tamanhoBytes }

    const destino = pastaVazia('psitrack-destino-')
    const sourceRowCounts = getRowCounts(db.$client)

    function criarSnapshotExternoComData(createdAt: string, blobEntries: BlobManifestEntry[]): string {
      escreverBackupExterno({ db, dek, destino, anexosDir, sourceRowCounts, blobEntries })
      const [maisRecente] = listarSnapshotsExternos(destino)
      reescreverCreatedAt(join(pastaSnapshots(destino), maisRecente!.pasta, 'manifest.json'), createdAt)
      return maisRecente!.pasta
    }

    // 7 diários (dias 0-6) — enchem a camada diária, sem o anexo.
    for (let d = 0; d <= 6; d++) criarSnapshotExternoComData(haDiasAtras(d), [])
    // 4 semanais (além da janela diária) — enchem a camada semanal, sem o anexo.
    for (const d of [10, 17, 24, 31]) criarSnapshotExternoComData(haDiasAtras(d), [])
    // 5 mensais de preenchimento (meses distintos, sem o anexo) — enchem quase toda a camada mensal.
    for (const m of [2, 3, 4, 5, 6]) criarSnapshotExternoComData(haMesesAtras(m), [])
    // 6º e último slot mensal, COM o anexo — este é quem precisa proteger o blob.
    const pastaRetidaComAnexo = criarSnapshotExternoComData(haMesesAtras(7), [entryAnexo])
    // Muito mais antigo (nenhuma camada tem vaga), com o MESMO blob — deve ser purgado.
    const pastaPurgadaComAnexo = criarSnapshotExternoComData(haMesesAtras(20), [entryAnexo])

    const resultado = executarPurga({ backupDir, destino, dek })

    expect(resultado.externo?.manter).toContain(pastaRetidaComAnexo)
    expect(resultado.externo?.purgar).toContain(pastaPurgadaComAnexo)
    expect(existsSync(join(pastaSnapshots(destino), pastaPurgadaComAnexo))).toBe(false)
    // O snapshot mensal retido ainda referencia o blob — sobrevive.
    expect(existsSync(join(pastaPool(destino), `${anexo.sha256Cifrado}.enc`))).toBe(true)
    expect(resultado.externo?.blobsPurgadosDoPool).toEqual([])

    // Segunda rodada: apaga também o snapshot retido (removendo a última referência) — agora o blob órfão some do pool.
    rmSync(join(pastaSnapshots(destino), pastaRetidaComAnexo), { recursive: true, force: true })
    const segundaPurga = executarPurga({ backupDir, destino, dek })
    expect(existsSync(join(pastaPool(destino), `${anexo.sha256Cifrado}.enc`))).toBe(false)
    expect(segundaPurga.externo?.blobsPurgadosDoPool).toContain(anexo.sha256Cifrado)
  })

  it('purga "interrompida" (pasta já ausente) não lança e a próxima execução completa normalmente', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })

    const primeiro = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })
    reescreverCreatedAt(join(backupDir, primeiro.pasta, 'manifest.json'), haDiasAtras(0))
    await new Promise((r) => setTimeout(r, 5))
    const segundo = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })
    reescreverCreatedAt(join(backupDir, segundo.pasta, 'manifest.json'), haDiasAtras(0)) // mesmo dia, mais recente — "primeiro" vira purgável

    // Simula uma purga anterior que já tinha apagado a pasta, mas não terminou.
    rmSync(join(backupDir, primeiro.pasta), { recursive: true, force: true })

    expect(() => executarPurga({ backupDir, destino: null, dek })).not.toThrow()
    expect(listarBackups(backupDir).map((b) => b.pasta)).toEqual([segundo.pasta])
  })

  it('verify falhando num backup retido cancela a purga inteira — nada é apagado', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })

    const antiga = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })
    reescreverCreatedAt(join(backupDir, antiga.pasta, 'manifest.json'), haDiasAtras(0))
    await new Promise((r) => setTimeout(r, 5))
    const retida = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })
    reescreverCreatedAt(join(backupDir, retida.pasta, 'manifest.json'), haDiasAtras(0)) // mesmo dia, mais recente — "antiga" seria purgada

    // Corrompe o backup que SERIA retido — a verificação dele tem que falhar.
    writeFileSync(join(backupDir, retida.pasta, 'snapshot.db'), 'isto não é mais um banco SQLite válido')

    expect(() => executarPurga({ backupDir, destino: null, dek })).toThrow()

    // Nada foi apagado, nem o que seria legitimamente purgado.
    const pastasRestantes = readdirSync(backupDir)
    expect(pastasRestantes).toContain(antiga.pasta)
    expect(pastasRestantes).toContain(retida.pasta)
  })
})

describe('previewPurga', () => {
  it('sem backup nenhum, devolve zeros sem lançar', () => {
    const preview = previewPurga(join(pastaVazia(), 'backups-inexistente'), null)
    expect(preview.local).toEqual({ totalBytes: 0, aLiberarBytes: 0, mantidos: 0, purgar: 0 })
    expect(preview.externo).toBeNull()
  })

  it('reflete a mesma decisão de calcularRetencao, sem apagar nada', async () => {
    const { db, dek, keysFilePath, anexosDir, backupDir } = await ambiente()
    criarPaciente(db, { nome: 'Paciente Teste' })

    const antigo = criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })
    reescreverCreatedAt(join(backupDir, antigo.pasta, 'manifest.json'), haDiasAtras(0))
    await new Promise((r) => setTimeout(r, 5))
    criarBackupManual({ db, dek, backupDir, anexosDir, keysFilePath })
    // (o segundo backup fica com o createdAt real, "agora" — já é o mais novo do dia por construção)

    const preview = previewPurga(backupDir, null)
    expect(preview.local.mantidos).toBe(1)
    expect(preview.local.purgar).toBe(1)
    expect(preview.local.aLiberarBytes).toBeGreaterThan(0)
    expect(preview.local.totalBytes).toBeGreaterThanOrEqual(preview.local.aLiberarBytes)

    // Dry-run de verdade: nada foi apagado.
    expect(listarBackups(backupDir)).toHaveLength(2)
    expect(existsSync(join(backupDir, antigo.pasta))).toBe(true)
  })
})
