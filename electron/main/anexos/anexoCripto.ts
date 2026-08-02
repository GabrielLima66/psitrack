import { createHash, randomBytes } from 'node:crypto'
import { open, seal, type SealedBox } from '../crypto/aes-gcm'

const FILE_DEK_LENGTH_BYTES = 32
const NONCE_LENGTH_BYTES = 12
const AUTH_TAG_LENGTH_BYTES = 16

export interface ArquivoCifrado {
  /** Exatamente os bytes que vão pro disco em `<uuid>.enc` — ciphertext + authTag concatenados. */
  blob: Buffer
  nonce: string // base64, da cifragem do conteúdo
  chaveEnvelopada: string // base64, DEK do arquivo envelopada pela chave mestra (D25)
  sha256Cifrado: string // hex de `blob`, pra `verify` de backup conferir sem decifrar (D26)
}

/**
 * DEK aleatória de 256 bits por arquivo (D25), nunca reaproveitada entre
 * anexos — mesma primitiva do envelope de banco (`crypto/aes-gcm.ts`),
 * nenhuma cripto nova é inventada aqui. Sem o banco (que guarda
 * `chaveEnvelopada`), o `.enc` sozinho no disco é lixo criptográfico: a
 * chave mestra sozinha não abre o arquivo, só o `chaveEnvelopada` certo
 * abre a DEK do arquivo, que só então abre o conteúdo.
 */
export function cifrarArquivo(bytes: Buffer, chaveMestra: Buffer): ArquivoCifrado {
  const fileDek = randomBytes(FILE_DEK_LENGTH_BYTES)
  const conteudo = seal(fileDek, bytes)
  const envelope = seal(chaveMestra, fileDek)
  fileDek.fill(0)

  const blob = Buffer.concat([conteudo.ciphertext, conteudo.authTag])
  const chaveEnvelopada = Buffer.concat([envelope.nonce, envelope.authTag, envelope.ciphertext])

  return {
    blob,
    nonce: conteudo.nonce.toString('base64'),
    chaveEnvelopada: chaveEnvelopada.toString('base64'),
    sha256Cifrado: createHash('sha256').update(blob).digest('hex')
  }
}

/**
 * Lança se `chaveMestra` estiver errada (não abre `chaveEnvelopada`) OU se
 * qualquer byte do blob/da chave envelopada tiver sido alterado — o tag do
 * GCM fazendo o trabalho nas duas camadas, nunca uma checagem manual.
 */
export function decifrarArquivo(blob: Buffer, nonce: string, chaveEnvelopada: string, chaveMestra: Buffer): Buffer {
  const envelopeBuffer = Buffer.from(chaveEnvelopada, 'base64')
  const envelopeBox: SealedBox = {
    nonce: envelopeBuffer.subarray(0, NONCE_LENGTH_BYTES),
    authTag: envelopeBuffer.subarray(NONCE_LENGTH_BYTES, NONCE_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES),
    ciphertext: envelopeBuffer.subarray(NONCE_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES)
  }
  const fileDek = open(chaveMestra, envelopeBox)

  try {
    const conteudoBox: SealedBox = {
      nonce: Buffer.from(nonce, 'base64'),
      authTag: blob.subarray(blob.length - AUTH_TAG_LENGTH_BYTES),
      ciphertext: blob.subarray(0, blob.length - AUTH_TAG_LENGTH_BYTES)
    }
    return open(fileDek, conteudoBox)
  } finally {
    fileDek.fill(0)
  }
}
