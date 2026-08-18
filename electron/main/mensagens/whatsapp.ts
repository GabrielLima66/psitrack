import { shell } from 'electron'
import type { PsiTrackDatabase } from '../db/connection'
import { definirLembreteEnviado, type Sessao } from '../db/repositories/sessao'
import { normalizarTelefoneBr } from './normalizarTelefone'

/** Pura — `null` quando o telefone não normaliza pra um número plausível (ver normalizarTelefoneBr). */
export function montarLinkWhatsapp(telefoneBruto: string | null, texto: string): string | null {
  const numero = normalizarTelefoneBr(telefoneBruto)
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

/**
 * Primeira vez neste app que `shell.openExternal` é disparado por uma ação
 * de feature deliberada (clique de botão), não só o guard defensivo em
 * `electron/main/index.ts` que intercepta links colados em conteúdo
 * clínico. Continua respeitando CLAUDE.md #7 ("sem rede"): o app não faz
 * nenhuma chamada de rede aqui — só entrega um link `https://wa.me/...` pro
 * SO abrir no WhatsApp Desktop ou no navegador padrão, igual um `mailto:`.
 * Quem eventualmente manda a mensagem é o WhatsApp, fora do processo do app.
 * Não testada (mesma categoria de `anexos/dialogos.ts`: wrapper de API
 * nativa do Electron, sem harness e2e neste projeto).
 */
export function abrirWhatsapp(db: PsiTrackDatabase, sessaoId: string, telefoneBruto: string | null, texto: string): { sessao: Sessao; link: string } {
  const link = montarLinkWhatsapp(telefoneBruto, texto)
  if (!link) {
    throw new Error('Telefone inválido ou ausente — marque como enviada manualmente pelo outro canal.')
  }
  shell.openExternal(link)
  const sessao = definirLembreteEnviado(db, sessaoId, true)
  return { sessao, link }
}
