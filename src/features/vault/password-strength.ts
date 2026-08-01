export const MIN_PASSWORD_LENGTH = 10

const TRIVIAL_SUBSTRINGS = [
  'senha',
  'password',
  '12345678',
  '123456789',
  '0123456789',
  'qwerty',
  'abcdefgh',
  'psitrack'
]

export function isTrivialPassword(password: string): boolean {
  const lower = password.toLowerCase()
  if (TRIVIAL_SUBSTRINGS.some((pattern) => lower.includes(pattern))) return true
  return new Set(password).size === 1 // tudo o mesmo caractere
}

export interface PasswordStrength {
  level: 0 | 1 | 2 | 3 | 4
  label: string
}

const LABELS = ['Fraca', 'Razoável', 'Boa', 'Forte']

/** Heurística simples (não é estimativa de entropia real) — só pra guiar a usuária, não é o controle de segurança em si (isso é o Argon2id). */
export function computePasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return { level: 0, label: '' }

  let score = 0
  if (password.length >= MIN_PASSWORD_LENGTH) score++
  if (password.length >= 16) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++

  const level = Math.max(1, Math.min(4, score)) as PasswordStrength['level']
  return { level, label: LABELS[level - 1] }
}
