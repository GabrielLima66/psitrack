import { ipcMain } from 'electron'
import {
  atualizarTemplate,
  criarTemplate,
  listarTemplates,
  removerTemplate,
  type MensagemTemplateInput
} from '../db/repositories/mensagemTemplate'
import { abrirWhatsapp } from '../mensagens/whatsapp'
import { getDb } from './vault'
import { safely } from './result'

/** Handlers do módulo de mensagens de confirmação: templates + disparo do link de WhatsApp. */
export function registerMensagensHandlers(): void {
  ipcMain.handle('mensagem:listarTemplates', () => safely(() => ({ templates: listarTemplates(getDb()) })))

  ipcMain.handle('mensagem:criarTemplate', (_event, input: MensagemTemplateInput) =>
    safely(() => ({ template: criarTemplate(getDb(), input) }))
  )

  ipcMain.handle('mensagem:atualizarTemplate', (_event, id: string, input: MensagemTemplateInput) =>
    safely(() => ({ template: atualizarTemplate(getDb(), id, input) }))
  )

  ipcMain.handle('mensagem:removerTemplate', (_event, id: string) =>
    safely(() => {
      removerTemplate(getDb(), id)
      return {}
    })
  )

  ipcMain.handle('mensagem:enviarConfirmacao', (_event, sessaoId: string, telefone: string | null, texto: string) =>
    safely(() => abrirWhatsapp(getDb(), sessaoId, telefone, texto))
  )
}
