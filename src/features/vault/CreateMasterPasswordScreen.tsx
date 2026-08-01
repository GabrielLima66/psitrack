import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AuthLayout } from './AuthLayout'
import { computePasswordStrength, isTrivialPassword, MIN_PASSWORD_LENGTH } from './password-strength'

interface CreateMasterPasswordScreenProps {
  busy: boolean
  serverError: string | null
  onSubmit: (password: string) => void
}

export function CreateMasterPasswordScreen({ busy, serverError, onSubmit }: CreateMasterPasswordScreenProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const strength = computePasswordStrength(password)

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      setValidationError(`Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    if (isTrivialPassword(password)) {
      setValidationError('Essa senha é fácil demais de adivinhar. Tente outra.')
      return
    }
    if (password !== confirmPassword) {
      setValidationError('As senhas não conferem.')
      return
    }
    setValidationError(null)
    onSubmit(password)
  }

  return (
    <AuthLayout
      panel={{
        headline: 'Seus prontuários nunca saem deste computador.',
        subtext:
          'Nada é enviado para servidores. Tudo fica criptografado no disco, e só a sua senha mestra abre.',
        footer: '100% LOCAL · SEM NUVEM'
      }}
    >
      <form onSubmit={handleSubmit} className="flex w-[400px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-foreground">Criar sua senha mestra</h1>
          <p className="text-balance text-sm leading-relaxed text-muted-foreground">
            Escolha uma senha longa e memorável. Ela não pode ser redefinida por e-mail.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Senha mestra</Label>
            <button
              type="button"
              className="text-[13px] text-muted-foreground hover:text-foreground"
              onClick={() => setVisible((value) => !value)}
            >
              {visible ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <Input
            id="password"
            type={visible ? 'text' : 'password'}
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-[42px] rounded-lg"
          />
          {password.length > 0 && (
            <div className="flex items-center gap-2.5 pt-0.5">
              <div className="flex flex-1 gap-1">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={cn(
                      'h-[3px] flex-1 rounded-full',
                      index < strength.level ? 'bg-primary' : 'bg-border'
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">Força: {strength.label.toLowerCase()}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <Input
            id="confirmPassword"
            type={visible ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-[42px] rounded-lg"
          />
        </div>

        {(validationError ?? serverError) && (
          <p className="text-[13px] text-destructive">{validationError ?? serverError}</p>
        )}

        <Button type="submit" disabled={busy} className="h-[42px] w-full rounded-lg">
          {busy ? 'Criando…' : 'Criar senha e continuar'}
        </Button>
      </form>
    </AuthLayout>
  )
}
