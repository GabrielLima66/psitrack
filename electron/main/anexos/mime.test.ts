import { describe, expect, it } from 'vitest'
import { mimeFromExtensao } from './mime'

describe('mimeFromExtensao', () => {
  it('reconhece pdf e imagens comuns', () => {
    expect(mimeFromExtensao('C:\\pasta\\laudo.pdf')).toBe('application/pdf')
    expect(mimeFromExtensao('foto.PNG')).toBe('image/png')
    expect(mimeFromExtensao('foto.jpg')).toBe('image/jpeg')
    expect(mimeFromExtensao('foto.jpeg')).toBe('image/jpeg')
  })

  it('extensão desconhecida cai em application/octet-stream', () => {
    expect(mimeFromExtensao('arquivo.xyz')).toBe('application/octet-stream')
    expect(mimeFromExtensao('sem-extensao')).toBe('application/octet-stream')
  })
})
