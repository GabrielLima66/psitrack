import { dialog, type BrowserWindow } from 'electron'

/**
 * Sob `PSITRACK_TEST_DIALOG_PATH`, devolve o caminho fixo em vez de abrir o
 * diálogo nativo do SO — sem isso não haveria como o Playwright dirigir um
 * fluxo de anexo (ou de export CSV, Etapa 13) de ponta a ponta, já que
 * diálogos nativos ficam fora do alcance de qualquer driver de teste
 * (SPEC-fase-3.md §5). Nunca ativo fora de teste: a variável só existe no
 * ambiente de quem escreve o teste, nunca em produção.
 */
export async function escolherArquivoParaAbrir(janela: BrowserWindow | null): Promise<string | null> {
  const caminhoDeTeste = process.env.PSITRACK_TEST_DIALOG_PATH
  if (caminhoDeTeste) return caminhoDeTeste

  const opcoes = { properties: ['openFile' as const] }
  const resultado = janela ? await dialog.showOpenDialog(janela, opcoes) : await dialog.showOpenDialog(opcoes)
  return resultado.canceled ? null : (resultado.filePaths[0] ?? null)
}

export interface OpcoesSalvar {
  title?: string
  filters?: { name: string; extensions: string[] }[]
}

export async function escolherDestinoParaSalvar(
  janela: BrowserWindow | null,
  nomeSugerido: string,
  opcoesExtra: OpcoesSalvar = {}
): Promise<string | null> {
  const caminhoDeTeste = process.env.PSITRACK_TEST_DIALOG_PATH
  if (caminhoDeTeste) return caminhoDeTeste

  const opcoes = { ...opcoesExtra, defaultPath: nomeSugerido }
  const resultado = janela ? await dialog.showSaveDialog(janela, opcoes) : await dialog.showSaveDialog(opcoes)
  return resultado.canceled ? null : (resultado.filePath ?? null)
}
