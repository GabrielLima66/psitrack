import { ipcMain } from 'electron'
import { listarEvolucoes, type CriarEvolucaoInput, type RetificarEvolucaoInput } from '../db/repositories/evolucao'
import {
  criarEvolucaoComCobranca,
  criarEvolucaoComSessaoRetroativa,
  retificarEvolucaoComCobranca,
  type CriarEvolucaoComSessaoRetroativaInput
} from '../db/repositories/faturamento'
import { getDb } from './vault'
import { safely } from './result'

/**
 * Handlers do domínio "evolução" — Etapa 7 (SPEC-fase-1.md) + cobrança
 * (Etapa 12/D15): criar e retificar passam pelos wrappers de
 * `faturamento.ts`, que marcam a sessão como `realizada` e disparam
 * `decidirCobranca` quando a entrada é `tipo='sessao'` com `sessaoId`. Só
 * criar/listar/retificar de propósito — prontuario_evolucao é append-only,
 * garantido por trigger SQLite (migrations 0001/0002).
 */
export function registerEvolucaoHandlers(): void {
  ipcMain.handle('evolucao:criar', (_event, input: CriarEvolucaoInput) => safely(() => criarEvolucaoComCobranca(getDb(), input)))

  ipcMain.handle('evolucao:listar', (_event, pacienteId: string) =>
    safely(() => ({ evolucoes: listarEvolucoes(getDb(), pacienteId) }))
  )

  ipcMain.handle('evolucao:retificar', (_event, input: RetificarEvolucaoInput) =>
    safely(() => retificarEvolucaoComCobranca(getDb(), input))
  )

  ipcMain.handle('evolucao:criarComSessaoRetroativa', (_event, input: CriarEvolucaoComSessaoRetroativaInput) =>
    safely(() => criarEvolucaoComSessaoRetroativa(getDb(), input))
  )
}
