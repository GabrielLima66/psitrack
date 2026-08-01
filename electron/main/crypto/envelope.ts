import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { deriveKek, DEFAULT_ARGON2_PARAMS, type Argon2Params } from './argon2'
import { seal, open, type SealedBox } from './aes-gcm'
import { generateRecoveryKey } from './recovery-key'

const DEK_LENGTH_BYTES = 32 // AES-256-GCM do banco (CLAUDE.md invariante #4)
const SALT_LENGTH_BYTES = 16

/** SealedBox com os campos binários em base64 — formato de disco do keys.json. */
export interface SealedBoxDTO {
  nonce: string
  authTag: string
  ciphertext: string
}

export interface PasswordEnvelope extends SealedBoxDTO {
  salt: string
  kdf: Argon2Params
}

export interface KeysFile {
  version: 1
  dek: {
    password: PasswordEnvelope
    recovery: SealedBoxDTO
  }
}

function toDTO(box: SealedBox): SealedBoxDTO {
  return {
    nonce: box.nonce.toString('base64'),
    authTag: box.authTag.toString('base64'),
    ciphertext: box.ciphertext.toString('base64')
  }
}

function fromDTO(dto: SealedBoxDTO): SealedBox {
  return {
    nonce: Buffer.from(dto.nonce, 'base64'),
    authTag: Buffer.from(dto.authTag, 'base64'),
    ciphertext: Buffer.from(dto.ciphertext, 'base64')
  }
}

/**
 * Cria uma DEK nova (aleatória, 256 bits) e o keys.json que a embrulha de
 * duas formas independentes: senha (via Argon2id) e recovery key (direto,
 * sem KDF — já é entropia máxima). A DEK retornada é a que deve ser usada
 * pra abrir o banco pela primeira vez; a chamadora é responsável por
 * mostrar `recoveryKey` pra usuária uma única vez e depois descartá-la.
 */
export async function createKeysFile(
  password: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS
): Promise<{ keysFile: KeysFile; dek: Buffer; recoveryKey: Buffer }> {
  const dek = randomBytes(DEK_LENGTH_BYTES)
  const recoveryKey = generateRecoveryKey()

  const salt = randomBytes(SALT_LENGTH_BYTES)
  const kek = await deriveKek(password, salt, params)
  const passwordBox = seal(kek, dek)
  kek.fill(0)

  const recoveryBox = seal(recoveryKey, dek)

  const keysFile: KeysFile = {
    version: 1,
    dek: {
      password: { salt: salt.toString('base64'), kdf: params, ...toDTO(passwordBox) },
      recovery: toDTO(recoveryBox)
    }
  }

  return { keysFile, dek, recoveryKey }
}

/** Abre a DEK a partir da senha mestra. Lança erro genérico se a senha estiver errada. */
export async function unwrapWithPassword(keysFile: KeysFile, password: string): Promise<Buffer> {
  const envelope = keysFile.dek.password
  const salt = Buffer.from(envelope.salt, 'base64')
  const kek = await deriveKek(password, salt, envelope.kdf)
  try {
    return open(kek, fromDTO(envelope))
  } catch {
    throw new Error('Senha incorreta.')
  } finally {
    kek.fill(0)
  }
}

/** Abre a DEK a partir da recovery key (bytes crus, já decodificados do base32). */
export function unwrapWithRecovery(keysFile: KeysFile, recoveryKey: Buffer): Buffer {
  try {
    return open(recoveryKey, fromDTO(keysFile.dek.recovery))
  } catch {
    throw new Error('Recovery key inválida.')
  }
}

/**
 * Troca a senha mestra: reescreve só o envelope de senha (novo salt, mesmos
 * parâmetros de KDF por padrão) em torno da mesma DEK. O envelope de
 * recovery key não é tocado. A senha antiga fica inválida porque o envelope
 * antigo é substituído — não existe lista de senhas revogadas.
 */
export async function changePassword(
  keysFile: KeysFile,
  oldPassword: string,
  newPassword: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS
): Promise<KeysFile> {
  const dek = await unwrapWithPassword(keysFile, oldPassword)
  try {
    const salt = randomBytes(SALT_LENGTH_BYTES)
    const kek = await deriveKek(newPassword, salt, params)
    const passwordBox = seal(kek, dek)
    kek.fill(0)

    return {
      version: keysFile.version,
      dek: {
        password: { salt: salt.toString('base64'), kdf: params, ...toDTO(passwordBox) },
        recovery: keysFile.dek.recovery
      }
    }
  } finally {
    dek.fill(0)
  }
}

export function readKeysFile(filePath: string): KeysFile {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as KeysFile
}

export function writeKeysFile(filePath: string, keysFile: KeysFile): void {
  writeFileSync(filePath, JSON.stringify(keysFile, null, 2), 'utf-8')
}
