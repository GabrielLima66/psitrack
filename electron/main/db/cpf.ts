import { z } from 'zod'

/**
 * Validação de CPF (dígito verificador) implementada à mão — algoritmo
 * simples e público, não justifica dependência nova. Aceita só os 11
 * dígitos (sem pontuação); a formatação é problema da UI.
 */
export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false
  if (new Set(cpf).size === 1) return false // 00000000000, 11111111111 etc. passam no checksum e nunca são válidos

  const digits = cpf.split('').map(Number)

  const checkDigit = (length: number): number => {
    let sum = 0
    for (let i = 0; i < length; i++) {
      sum += digits[i] * (length + 1 - i)
    }
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  return checkDigit(9) === digits[9] && checkDigit(10) === digits[10]
}

export const cpfSchema = z
  .string()
  .regex(/^\d{11}$/, 'CPF deve ter 11 dígitos.')
  .refine(isValidCpf, { message: 'CPF inválido.' })
