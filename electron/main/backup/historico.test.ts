import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lerHistorico, registrarExecucao, type ExecucaoBackupAutomatico } from './historico'

function pastaVazia(): string {
  return mkdtempSync(join(tmpdir(), 'psitrack-historico-'))
}

function execucao(overrides: Partial<ExecucaoBackupAutomatico> = {}): ExecucaoBackupAutomatico {
  return {
    executadoEm: new Date().toISOString(),
    gatilho: 'destrancar',
    localOk: true,
    destinoOk: null,
    ...overrides
  }
}

describe('historico', () => {
  it('sem arquivo ainda, devolve lista vazia', () => {
    expect(lerHistorico(join(pastaVazia(), 'historico-automatico.json'))).toEqual([])
  })

  it('grava e lê de volta, mais recente primeiro', () => {
    const caminho = join(pastaVazia(), 'historico-automatico.json')
    registrarExecucao(caminho, execucao({ executadoEm: '2026-08-01T00:00:00.000Z' }))
    registrarExecucao(caminho, execucao({ executadoEm: '2026-08-02T00:00:00.000Z' }))

    const historico = lerHistorico(caminho)
    expect(historico).toHaveLength(2)
    expect(historico[0]!.executadoEm).toBe('2026-08-02T00:00:00.000Z')
    expect(historico[1]!.executadoEm).toBe('2026-08-01T00:00:00.000Z')
  })

  it('mantém só os 10 registros mais recentes', () => {
    const caminho = join(pastaVazia(), 'historico-automatico.json')
    for (let i = 0; i < 15; i++) {
      registrarExecucao(caminho, execucao({ executadoEm: `2026-08-01T00:00:${String(i).padStart(2, '0')}.000Z` }))
    }
    const historico = lerHistorico(caminho)
    expect(historico).toHaveLength(10)
    expect(historico[0]!.executadoEm).toBe('2026-08-01T00:00:14.000Z') // o último gravado
  })
})
