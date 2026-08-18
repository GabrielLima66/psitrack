import { describe, expect, it } from 'vitest'
import { montarLinkWhatsapp } from './whatsapp'

describe('montarLinkWhatsapp', () => {
  it('monta a URL wa.me com o número normalizado e o texto codificado', () => {
    const link = montarLinkWhatsapp('(11) 98765-4321', 'Olá Maria, confirmando sua sessão às 14:00!')
    expect(link).toBe('https://wa.me/5511987654321?text=Ol%C3%A1%20Maria%2C%20confirmando%20sua%20sess%C3%A3o%20%C3%A0s%2014%3A00!')
  })

  it('telefone inválido/ausente devolve null', () => {
    expect(montarLinkWhatsapp(null, 'texto')).toBeNull()
    expect(montarLinkWhatsapp('123', 'texto')).toBeNull()
  })
})
