import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { gravarUltimaRestauracao, lerUltimaRestauracao } from './registroRestauracao'

describe('registroRestauracao', () => {
  it('sem restauração ainda, devolve null', () => {
    const backupDir = mkdtempSync(join(tmpdir(), 'psitrack-backups-'))
    expect(lerUltimaRestauracao(backupDir)).toBeNull()
  })

  it('grava e lê de volta o mesmo registro', () => {
    const backupDir = mkdtempSync(join(tmpdir(), 'psitrack-backups-'))
    const registro = { restauradoEm: '2026-08-02T21:00:00.000Z', pastaOrigem: 'backup-2026-08-01T10-00-00-000Z' }

    gravarUltimaRestauracao(backupDir, registro)

    expect(lerUltimaRestauracao(backupDir)).toEqual(registro)
  })

  it('uma segunda restauração sobrescreve a anterior — só a mais recente fica registrada', () => {
    const backupDir = mkdtempSync(join(tmpdir(), 'psitrack-backups-'))
    gravarUltimaRestauracao(backupDir, { restauradoEm: '2026-08-01T00:00:00.000Z', pastaOrigem: 'backup-antigo' })
    gravarUltimaRestauracao(backupDir, { restauradoEm: '2026-08-02T00:00:00.000Z', pastaOrigem: 'backup-novo' })

    expect(lerUltimaRestauracao(backupDir)).toEqual({ restauradoEm: '2026-08-02T00:00:00.000Z', pastaOrigem: 'backup-novo' })
  })
})
