import { describe, expect, it } from 'vitest'
import {
  createKeysFile,
  unwrapWithPassword,
  unwrapWithRecovery,
  changePassword,
  rewrapKeysFile
} from './envelope'

describe('envelope', () => {
  it('a senha certa reabre a mesma DEK gerada na criação', async () => {
    const { keysFile, dek } = await createKeysFile('senha-correta')
    const reopened = await unwrapWithPassword(keysFile, 'senha-correta')
    expect(reopened.equals(dek)).toBe(true)
  })

  it('senha errada não abre', async () => {
    const { keysFile } = await createKeysFile('senha-correta')
    await expect(unwrapWithPassword(keysFile, 'senha-errada')).rejects.toThrow()
  })

  it('recovery key abre a mesma DEK sem precisar da senha', async () => {
    const { keysFile, dek, recoveryKey } = await createKeysFile('senha-correta')
    const reopened = unwrapWithRecovery(keysFile, recoveryKey)
    expect(reopened.equals(dek)).toBe(true)
  })

  it('recovery key errada não abre', async () => {
    const { keysFile } = await createKeysFile('senha-correta')
    expect(() => unwrapWithRecovery(keysFile, Buffer.alloc(32, 9))).toThrow()
  })

  it('troca de senha: não perde a DEK e invalida a senha antiga', async () => {
    const { keysFile, dek } = await createKeysFile('senha-antiga')
    const rotated = await changePassword(keysFile, 'senha-antiga', 'senha-nova')

    // dado (a DEK) preservado sob a senha nova
    const viaNova = await unwrapWithPassword(rotated, 'senha-nova')
    expect(viaNova.equals(dek)).toBe(true)

    // senha antiga não abre mais o envelope novo
    await expect(unwrapWithPassword(rotated, 'senha-antiga')).rejects.toThrow()
  })

  it('troca de senha não toca no envelope de recovery key', async () => {
    const { keysFile, recoveryKey, dek } = await createKeysFile('senha-antiga')
    const rotated = await changePassword(keysFile, 'senha-antiga', 'senha-nova')

    expect(rotated.dek.recovery).toEqual(keysFile.dek.recovery)
    expect(unwrapWithRecovery(rotated, recoveryKey).equals(dek)).toBe(true)
  })

  it('troca de senha com senha antiga errada falha sem alterar nada', async () => {
    const { keysFile } = await createKeysFile('senha-antiga')
    await expect(changePassword(keysFile, 'senha-errada', 'senha-nova')).rejects.toThrow()
  })

  it('gera salt novo a cada troca de senha (envelope não é reaproveitado)', async () => {
    const { keysFile } = await createKeysFile('senha-antiga')
    const rotated = await changePassword(keysFile, 'senha-antiga', 'senha-nova')
    expect(rotated.dek.password.salt).not.toBe(keysFile.dek.password.salt)
  })

  it('rewrapKeysFile: mantém a mesma DEK sob senha e recovery key novas', async () => {
    const { dek } = await createKeysFile('senha-original')
    const { keysFile: rewrapped, recoveryKey: novaRecoveryKey } = await rewrapKeysFile(dek, 'senha-pos-recovery')

    const viaSenhaNova = await unwrapWithPassword(rewrapped, 'senha-pos-recovery')
    expect(viaSenhaNova.equals(dek)).toBe(true)

    const viaRecoveryNova = unwrapWithRecovery(rewrapped, novaRecoveryKey)
    expect(viaRecoveryNova.equals(dek)).toBe(true)
  })

  it('rewrapKeysFile: a recovery key antiga deixa de abrir o envelope novo', async () => {
    const { keysFile, dek, recoveryKey: recoveryKeyAntiga } = await createKeysFile('senha-original')
    const { keysFile: rewrapped } = await rewrapKeysFile(dek, 'senha-pos-recovery')

    expect(rewrapped.dek.recovery).not.toEqual(keysFile.dek.recovery)
    expect(() => unwrapWithRecovery(rewrapped, recoveryKeyAntiga)).toThrow()
  })
})
