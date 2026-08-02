import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { BrowserWindow, ipcMain } from 'electron'
import {
  excluirAnexo,
  lerAnexo,
  listarAnexosPaciente,
  obterAnexoOuFalhar,
  restaurarAnexo,
  salvarAnexo,
  type ListarAnexosOptions,
  type SalvarAnexoInput
} from '../anexos/anexoStore'
import { escolherArquivoParaAbrir, escolherDestinoParaSalvar } from '../anexos/dialogos'
import { mimeFromExtensao } from '../anexos/mime'
import type { KeySession } from '../crypto/session'
import { getAnexosDir } from '../paths'
import { safely } from './result'
import { getDb } from './vault'

/** `nomeOriginal`/`mime` vêm do arquivo escolhido no diálogo, nunca do renderer. */
export type AnexarViaDialogoInput = Omit<SalvarAnexoInput, 'pacienteId' | 'nomeOriginal' | 'mime'>

/** Handlers da aba Documentos — Etapa 16 (SPEC-fase-3.md). */
export function registerAnexosHandlers(session: KeySession): void {
  ipcMain.handle('anexo:listar', (_event, pacienteId: string, options?: ListarAnexosOptions) =>
    safely(() => ({ anexos: listarAnexosPaciente(getDb(), pacienteId, options) }))
  )

  ipcMain.handle('anexo:anexarViaDialogo', async (event, pacienteId: string, input: AnexarViaDialogoInput) =>
    safely(async () => {
      const janela = BrowserWindow.fromWebContents(event.sender)
      const caminho = await escolherArquivoParaAbrir(janela)
      if (!caminho) return { cancelado: true as const }

      const bytes = readFileSync(caminho)
      const anexo = salvarAnexo(getDb(), getAnexosDir(), session.getDek(), bytes, {
        ...input,
        pacienteId,
        nomeOriginal: basename(caminho),
        mime: mimeFromExtensao(caminho)
      })
      return { cancelado: false as const, anexo }
    })
  )

  // Decifra em memória e devolve os bytes — nunca escreve plaintext em disco (D28, I7).
  ipcMain.handle('anexo:ler', (_event, anexoId: string) =>
    safely(() => {
      const row = obterAnexoOuFalhar(getDb(), anexoId)
      const bytes = lerAnexo(getDb(), getAnexosDir(), session.getDek(), anexoId)
      return { bytes, mime: row.mime, nomeOriginal: row.nomeOriginal }
    })
  )

  // Único ponto do fluxo de anexos que escreve plaintext em disco de propósito
  // (D29): saída explícita da proteção do app, pra formato sem preview.
  ipcMain.handle('anexo:salvarCopia', async (event, anexoId: string) =>
    safely(async () => {
      const row = obterAnexoOuFalhar(getDb(), anexoId)
      const janela = BrowserWindow.fromWebContents(event.sender)
      const destino = await escolherDestinoParaSalvar(janela, row.nomeOriginal)
      if (!destino) return { cancelado: true as const }

      const bytes = lerAnexo(getDb(), getAnexosDir(), session.getDek(), anexoId)
      writeFileSync(destino, bytes)
      return { cancelado: false as const, caminho: destino }
    })
  )

  ipcMain.handle('anexo:excluir', (_event, id: string) =>
    safely(() => {
      excluirAnexo(getDb(), id)
      return {}
    })
  )

  ipcMain.handle('anexo:restaurar', (_event, id: string) =>
    safely(() => {
      restaurarAnexo(getDb(), id)
      return {}
    })
  )
}
