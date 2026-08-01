import { useState } from 'react'
import { cn } from '@/lib/utils'

interface AutoLockScreenProps {
  busy: boolean
  error: string | null
  lastSection: string
  onSubmit: (password: string) => void
  onForgotPassword: () => void
}

/** Cobre a janela inteira com a cor do painel de identidade — sinal visual de que o tom mudou (CLAUDE.md invariante #6). */
export function AutoLockScreen({ busy, error, lastSection, onSubmit, onForgotPassword }: AutoLockScreenProps) {
  const [password, setPassword] = useState('')

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault()
    if (!password || busy) return
    onSubmit(password)
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-panel">
      <div className="flex w-[420px] flex-col gap-7">
        <div className="flex flex-col gap-3">
          <div className="font-mono text-[11.5px] tracking-[0.08em] text-panel-foreground/50">SESSÃO BLOQUEADA</div>
          <div className="text-balance text-[28px] font-semibold text-panel-foreground">
            A tela travou por inatividade.
          </div>
          <div className="text-balance text-sm leading-relaxed text-panel-foreground/66">
            Passaram-se 5 minutos sem uso. Nada do seu trabalho foi perdido — digite a senha para voltar exatamente
            de onde parou.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="self-start rounded-full bg-white/8 px-3.5 py-1.5 text-[12.5px] text-panel-foreground/70">
            Você estava em: {lastSection}
          </div>
          <input
            type="password"
            autoFocus
            disabled={busy}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={cn(
              'h-[46px] rounded-lg border bg-white/6 px-3.5 text-sm text-panel-foreground outline-none',
              error ? 'border-red-400/60' : 'border-panel-foreground/20',
              busy && 'opacity-60'
            )}
          />
          {error && <p className="text-[13px] text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="h-[46px] rounded-lg bg-panel-foreground font-semibold text-panel disabled:opacity-70"
          >
            {busy ? 'Abrindo o cofre…' : 'Desbloquear'}
          </button>
          <button
            type="button"
            onClick={onForgotPassword}
            className="text-center text-[13px] text-panel-foreground/60 underline underline-offset-[3px]"
          >
            Não tenho a senha
          </button>
        </form>
      </div>
    </div>
  )
}
