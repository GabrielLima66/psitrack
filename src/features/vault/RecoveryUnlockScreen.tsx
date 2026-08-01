import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AuthLayout } from './AuthLayout'
import { countEnteredChars, formatRecoveryKeyInput, RECOVERY_KEY_TOTAL_CHARS } from './recovery-key-input'

interface RecoveryUnlockScreenProps {
  busy: boolean
  error: string | null
  onSubmit: (recoveryKey: string) => void
  onBackToPassword: () => void
}

export function RecoveryUnlockScreen({ busy, error, onSubmit, onBackToPassword }: RecoveryUnlockScreenProps) {
  const [value, setValue] = useState('')
  const enteredChars = countEnteredChars(value)
  const complete = enteredChars >= RECOVERY_KEY_TOTAL_CHARS

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    if (busy || !complete) return
    onSubmit(value)
  }

  return (
    <AuthLayout
      panel={{
        headline: 'Use a chave que você guardou.',
        subtext: 'É a chave de 256 bits anotada quando você criou a senha mestra.',
        footer: 'RECUPERAÇÃO DE ACESSO'
      }}
    >
      <form onSubmit={handleSubmit} className="flex w-full max-w-[440px] flex-col gap-5">
        <button
          type="button"
          onClick={onBackToPassword}
          className="self-start text-[13px] text-muted-foreground hover:text-foreground"
        >
          ← Voltar para a senha
        </button>
        <h1 className="text-[22px] font-semibold text-foreground">Entrar com a chave de recuperação</h1>

        <div className="flex flex-col gap-2">
          <Label htmlFor="recovery-key">Chave de recuperação</Label>
          <Input
            id="recovery-key"
            autoFocus
            disabled={busy}
            value={value}
            onChange={(event) => setValue(formatRecoveryKeyInput(event.target.value))}
            className={cn(
              'h-[46px] rounded-lg font-mono text-base tracking-[0.08em] focus-visible:border-primary',
              error && 'border-destructive'
            )}
          />
          <p className="text-[12.5px] text-muted-foreground">
            Os hífens são inseridos automaticamente. {enteredChars} de {RECOVERY_KEY_TOTAL_CHARS} caracteres.
          </p>
          {error && <p className="text-[13px] text-destructive">{error}</p>}
        </div>

        <Button type="submit" disabled={busy || !complete} className="h-[42px] w-full rounded-lg">
          {busy ? 'Verificando…' : 'Entrar com a chave'}
        </Button>

        <p className="text-balance border-t border-border pt-4 text-[13px] leading-normal text-muted-foreground">
          Ao entrar, você vai definir uma nova senha mestra — e receber uma nova chave. A atual deixa de valer.
        </p>
      </form>
    </AuthLayout>
  )
}
