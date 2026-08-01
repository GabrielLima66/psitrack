import type { ReactNode } from 'react'
import { IdentityPanel } from './IdentityPanel'

interface AuthLayoutProps {
  panel: { headline: string; subtext?: string; footer: string }
  children: ReactNode
}

/** Layout split das telas de auth: painel de identidade fixo à esquerda, conteúdo centralizado à direita. */
export function AuthLayout({ panel, children }: AuthLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <IdentityPanel {...panel} />
      <div className="flex flex-1 items-center justify-center p-12">{children}</div>
    </div>
  )
}
