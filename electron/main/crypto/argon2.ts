import { hashRaw } from '@node-rs/argon2'

// @node-rs/argon2 exporta Algorithm/Version como `declare const enum`, que não
// dá pra importar com `isolatedModules` ligado (TS2748) — os valores abaixo
// são os das entradas Argon2id e V0x13 dessas enums, copiados diretamente.
const ARGON2ID = 2
const VERSION_0X13 = 1

/**
 * Parâmetros do Argon2id gravados no envelope de senha (keys.json), para que
 * uma troca futura de tuning não invalide envelopes já gravados em disco.
 */
export interface Argon2Params {
  algorithm: 'argon2id'
  memoryCost: number
  timeCost: number
  parallelism: number
}

// Tier "paranoid" da recomendação OWASP: justificado porque é app desktop de
// usuário único (não é memory-constrained) e guarda dado de saúde mental.
export const DEFAULT_ARGON2_PARAMS: Argon2Params = {
  algorithm: 'argon2id',
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4
}

const KEK_LENGTH_BYTES = 32 // AES-256-GCM exige chave de 256 bits

/** Deriva a KEK (chave que embrulha a DEK) a partir da senha mestra. */
export async function deriveKek(
  password: string,
  salt: Buffer,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS
): Promise<Buffer> {
  return hashRaw(password, {
    algorithm: ARGON2ID,
    version: VERSION_0X13,
    memoryCost: params.memoryCost,
    timeCost: params.timeCost,
    parallelism: params.parallelism,
    outputLen: KEK_LENGTH_BYTES,
    salt
  })
}
