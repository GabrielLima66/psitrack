import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { AuthLayout } from './AuthLayout'

interface UnlockScreenProps {
  busy: boolean
  error: string | null
  onSubmit: (password: string) => void
  onForgotPassword: () => void
}

export function UnlockScreen({ busy, error, onSubmit, onForgotPassword }: UnlockScreenProps) {
  const [password, setPassword] = useState('')

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    if (!password || busy) return
    onSubmit(password)
  }

  return (
    <AuthLayout panel={{ headline: 'Bem-vinda de volta.', footer: '100% LOCAL · SEM NUVEM' }}>
      <form onSubmit={handleSubmit} className="flex w-[360px] flex-col gap-5">
        <div className={cn('flex flex-col gap-2', busy && 'opacity-55')}>
          <Label htmlFor="unlock-password">Senha mestra</Label>
          <Input
            id="unlock-password"
            type="password"
            autoFocus
            disabled={busy}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={cn('h-[42px] rounded-lg', error && 'border-destructive', busy && 'bg-muted')}
          />
          {error && !busy && <p className="text-[13px] text-destructive">{error}</p>}
        </div>

        <Button
          type="submit"
          disabled={busy}
          className={cn('h-[42px] w-full rounded-lg', busy && 'cursor-progress opacity-85')}
        >
          {busy ? (
            <>
              <span className="size-3.5 animate-spin rounded-full border-2 border-white/35 border-t-current [animation-duration:0.8s]" />
              Abrindo o cofre…
            </>
          ) : (
            'Entrar'
          )}
        </Button>

        {busy && <p className="text-center text-[12.5px] text-muted-foreground">Isso leva alguns segundos.</p>}

        <button
          type="button"
          onClick={onForgotPassword}
          className="text-center text-[13px] text-muted-foreground underline decoration-solid underline-offset-[3px] hover:text-foreground"
        >
          Não tenho a senha
        </button>
      </form>
    </AuthLayout>
  )
}
