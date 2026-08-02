import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { cifrarArquivo, decifrarArquivo } from './anexoCripto'

describe('cifrarArquivo / decifrarArquivo', () => {
  it('cifra e decifra devolve bytes idênticos ao original', () => {
    const chaveMestra = randomBytes(32)
    const original = Buffer.from('conteúdo de um laudo em PDF, aqui só bytes de teste', 'utf-8')

    const cifrado = cifrarArquivo(original, chaveMestra)
    const decifrado = decifrarArquivo(cifrado.blob, cifrado.nonce, cifrado.chaveEnvelopada, chaveMestra)

    expect(decifrado.equals(original)).toBe(true)
  })

  it('duas cifragens do mesmo conteúdo produzem blobs diferentes (DEK e nonce novos a cada vez)', () => {
    const chaveMestra = randomBytes(32)
    const original = Buffer.from('mesmo conteúdo')

    const a = cifrarArquivo(original, chaveMestra)
    const b = cifrarArquivo(original, chaveMestra)

    expect(a.blob.equals(b.blob)).toBe(false)
    expect(a.chaveEnvelopada).not.toBe(b.chaveEnvelopada)
  })

  it('alterar 1 byte do blob faz decifrarArquivo lançar, nunca devolver lixo', () => {
    const chaveMestra = randomBytes(32)
    const cifrado = cifrarArquivo(Buffer.from('dado sensível'), chaveMestra)

    const blobAlterado = Buffer.from(cifrado.blob)
    blobAlterado[0] = blobAlterado[0]! ^ 0xff

    expect(() => decifrarArquivo(blobAlterado, cifrado.nonce, cifrado.chaveEnvelopada, chaveMestra)).toThrow()
  })

  it('alterar 1 byte da chaveEnvelopada faz decifrarArquivo lançar', () => {
    const chaveMestra = randomBytes(32)
    const cifrado = cifrarArquivo(Buffer.from('dado sensível'), chaveMestra)

    const envelopeBuffer = Buffer.from(cifrado.chaveEnvelopada, 'base64')
    envelopeBuffer[0] = envelopeBuffer[0]! ^ 0xff
    const envelopeAlterado = envelopeBuffer.toString('base64')

    expect(() => decifrarArquivo(cifrado.blob, cifrado.nonce, envelopeAlterado, chaveMestra)).toThrow()
  })

  it('chaveEnvelopada de um banco (chave mestra diferente) não abre o blob de outro', () => {
    const chaveMestraA = randomBytes(32)
    const chaveMestraB = randomBytes(32)
    const cifrado = cifrarArquivo(Buffer.from('pertence só ao banco A'), chaveMestraA)

    expect(() => decifrarArquivo(cifrado.blob, cifrado.nonce, cifrado.chaveEnvelopada, chaveMestraB)).toThrow()
  })

  it('sha256Cifrado bate com o hash real do blob — dá pra conferir sem decifrar', () => {
    const chaveMestra = randomBytes(32)
    const cifrado = cifrarArquivo(Buffer.from('conteúdo qualquer'), chaveMestra)

    expect(cifrado.sha256Cifrado).toBe(createHash('sha256').update(cifrado.blob).digest('hex'))
  })
})
