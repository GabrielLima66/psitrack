import { z } from 'zod'

/**
 * Dinheiro é sempre inteiro de centavos, nunca float (CLAUDE.md invariante
 * de dado #3). `Number.isInteger` sozinho não bastaria pra JSON vindo de
 * fora (IPC pode entregar `NaN`/`Infinity` desserializados como number) —
 * por isso a checagem explícita de finitude.
 */
export function isCentavosValido(valor: number): boolean {
  return Number.isInteger(valor) && Number.isFinite(valor)
}

export const centavosSchema = z
  .number()
  .refine(isCentavosValido, { message: 'Valor deve ser um número inteiro de centavos.' })
