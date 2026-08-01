import { ipcMain } from 'electron'
import {
  atualizarAnotacao,
  criarAnotacao,
  excluirAnotacao,
  listarAnotacoes,
  type AnotacaoInput
} from '../db/repositories/anotacoes'
import { getDb } from './vault'
import { safely } from './result'

/**
 * Handlers do domínio "anotação privada" — Etapa 8 (SPEC-fase-1.md). Ao
 * contrário de evolução: edição e exclusão são livres (UPDATE de verdade e
 * soft delete), sem trigger nenhuma bloqueando. Nunca cruza pra
 * coletarParaExport (electron/main/db/repositories/export.ts).
 */
export function registerAnotacoesHandlers(): void {
  ipcMain.handle('anotacao:criar', (_event, pacienteId: string, input: AnotacaoInput) =>
    safely(() => ({ anotacao: criarAnotacao(getDb(), pacienteId, input) }))
  )

  ipcMain.handle('anotacao:atualizar', (_event, id: string, input: AnotacaoInput) =>
    safely(() => ({ anotacao: atualizarAnotacao(getDb(), id, input) }))
  )

  ipcMain.handle('anotacao:listar', (_event, pacienteId: string) =>
    safely(() => ({ anotacoes: listarAnotacoes(getDb(), pacienteId) }))
  )

  ipcMain.handle('anotacao:excluir', (_event, id: string) =>
    safely(() => {
      excluirAnotacao(getDb(), id)
      return {}
    })
  )
}
