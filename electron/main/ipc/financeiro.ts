import { ipcMain } from 'electron'
import { listarContratosPaciente, precoVigenteEm, type ContratoPrecoInput } from '../db/repositories/contratoPreco'
import { reajustarContrato } from '../db/repositories/faturamento'
import { cancelarLancamento, criarLancamentoAjuste, listarLancamentosPaciente, type LancamentoAjusteInput } from '../db/repositories/lancamento'
import { getDb } from './vault'
import { safely } from './result'

/** Handlers da aba Financeiro — Etapa 12 (SPEC-fase-2.md): contrato (vigente/histórico/reajuste) e lançamentos. */
export function registerFinanceiroHandlers(): void {
  ipcMain.handle('contrato:vigente', (_event, pacienteId: string, data: string) =>
    safely(() => ({ contrato: precoVigenteEm(getDb(), pacienteId, data) ?? null }))
  )

  ipcMain.handle('contrato:historico', (_event, pacienteId: string) =>
    safely(() => ({ contratos: listarContratosPaciente(getDb(), pacienteId) }))
  )

  ipcMain.handle('contrato:reajustar', (_event, pacienteId: string, input: ContratoPrecoInput) =>
    safely(() => reajustarContrato(getDb(), pacienteId, input))
  )

  ipcMain.handle('lancamento:listar', (_event, pacienteId: string) =>
    safely(() => ({ lancamentos: listarLancamentosPaciente(getDb(), pacienteId) }))
  )

  ipcMain.handle('lancamento:criarAjuste', (_event, pacienteId: string, input: LancamentoAjusteInput) =>
    safely(() => ({ lancamento: criarLancamentoAjuste(getDb(), pacienteId, input) }))
  )

  ipcMain.handle('lancamento:cancelar', (_event, id: string) => safely(() => ({ lancamento: cancelarLancamento(getDb(), id) })))
}
