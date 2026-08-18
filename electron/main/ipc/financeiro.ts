import { writeFileSync } from 'node:fs'
import { BrowserWindow, ipcMain } from 'electron'
import { escolherDestinoParaSalvar } from '../anexos/dialogos'
import { listarContratosPaciente, precoVigenteEm, type ContratoPrecoInput } from '../db/repositories/contratoPreco'
import { reajustarContrato } from '../db/repositories/faturamento'
import {
  cancelarLancamento,
  criarLancamentoAjuste,
  listarLancamentosPaciente,
  listarLancamentosPendentesTodos,
  reabrirLancamento,
  type LancamentoAjusteInput
} from '../db/repositories/lancamento'
import {
  estornarPagamento,
  listarPagamentosPaciente,
  marcarReciboEmitido,
  registrarPagamento,
  type EstornarPagamentoInput,
  type MarcarReciboEmitidoInput,
  type RegistrarPagamentoInput
} from '../db/repositories/pagamento'
import { gerarCsvRelatorio, gerarRelatorioMensal } from '../db/repositories/relatorio'
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

  ipcMain.handle('lancamento:reabrir', (_event, id: string) => safely(() => ({ lancamento: reabrirLancamento(getDb(), id) })))

  ipcMain.handle('lancamento:listarPendentesTodos', () => safely(() => ({ lancamentos: listarLancamentosPendentesTodos(getDb()) })))

  ipcMain.handle('pagamento:registrar', (_event, pacienteId: string, input: RegistrarPagamentoInput) =>
    safely(() => ({ pagamento: registrarPagamento(getDb(), pacienteId, input) }))
  )

  ipcMain.handle('pagamento:listar', (_event, pacienteId: string) =>
    safely(() => ({ pagamentos: listarPagamentosPaciente(getDb(), pacienteId) }))
  )

  ipcMain.handle('pagamento:marcarReciboEmitido', (_event, id: string, input: MarcarReciboEmitidoInput) =>
    safely(() => ({ pagamento: marcarReciboEmitido(getDb(), id, input) }))
  )

  ipcMain.handle('pagamento:estornar', (_event, id: string, input: EstornarPagamentoInput) =>
    safely(() => ({ pagamento: estornarPagamento(getDb(), id, input) }))
  )

  ipcMain.handle('relatorio:mensal', (_event, competencia: string) => safely(() => ({ relatorio: gerarRelatorioMensal(getDb(), competencia) })))

  // Export CSV local (I8 — sem rede): caminho escolhido pela usuária via diálogo nativo do SO.
  // Usa o mesmo hook de diálogo dos anexos (Etapa 16) — sob PSITRACK_TEST_DIALOG_PATH
  // o Playwright consegue dirigir este fluxo de ponta a ponta também.
  ipcMain.handle('relatorio:exportarCsv', async (event, competencia: string) =>
    safely(async () => {
      const relatorio = gerarRelatorioMensal(getDb(), competencia)
      const csv = gerarCsvRelatorio(relatorio)
      const janela = BrowserWindow.fromWebContents(event.sender)
      const destino = await escolherDestinoParaSalvar(janela, `receita-saude-${competencia}.csv`, {
        title: 'Exportar relatório do mês',
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (!destino) return { cancelado: true }
      writeFileSync(destino, csv, 'utf-8')
      return { cancelado: false, caminho: destino }
    })
  )
}
