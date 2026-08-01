import { ipcMain } from 'electron'
import {
  criarEvolucao,
  listarEvolucoes,
  retificarEvolucao,
  type CriarEvolucaoInput,
  type RetificarEvolucaoInput
} from '../db/repositories/evolucao'
import { getDb } from './vault'
import { safely } from './result'

/**
 * Handlers do domínio "evolução" — Etapa 7 (SPEC-fase-1.md). Só
 * criar/listar/retificar de propósito: NÃO existe evolucao:atualizar nem
 * evolucao:excluir — prontuario_evolucao é append-only, garantido por
 * trigger SQLite (migrations 0001/0002). Correção é sempre uma entrada
 * nova via retificar, nunca UPDATE/DELETE na linha existente.
 */
export function registerEvolucaoHandlers(): void {
  ipcMain.handle('evolucao:criar', (_event, input: CriarEvolucaoInput) =>
    safely(() => ({ evolucao: criarEvolucao(getDb(), input) }))
  )

  ipcMain.handle('evolucao:listar', (_event, pacienteId: string) =>
    safely(() => ({ evolucoes: listarEvolucoes(getDb(), pacienteId) }))
  )

  ipcMain.handle('evolucao:retificar', (_event, input: RetificarEvolucaoInput) =>
    safely(() => ({ evolucao: retificarEvolucao(getDb(), input) }))
  )
}
