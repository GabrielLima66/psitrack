import { useEffect, type ReactNode } from 'react'
import { AutoLockScreen } from './AutoLockScreen'
import { CreateMasterPasswordScreen } from './CreateMasterPasswordScreen'
import { RecoveryKeyRevealScreen } from './RecoveryKeyRevealScreen'
import { RecoveryUnlockScreen } from './RecoveryUnlockScreen'
import { useVaultStore } from './store'
import { UnlockScreen } from './UnlockScreen'

interface VaultFlowProps {
  /** Conteúdo real do app — só é renderizado quando o cofre está desbloqueado. */
  children: ReactNode
}

/** Decide qual das telas de auth mostrar, ou o app de verdade, com base no estado do vault. */
export function VaultFlow({ children }: VaultFlowProps) {
  const store = useVaultStore()

  useEffect(() => {
    void store.checkStatus()
    return window.psitrack.vault.onLocked(() => store.onAutoLocked())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  switch (store.screen) {
    case 'loading':
      return <div className="h-screen w-full bg-background" />

    case 'create-password':
      return (
        <CreateMasterPasswordScreen busy={store.authBusy} serverError={store.authError} onSubmit={store.createPassword} />
      )

    case 'create-password-after-recovery':
      return (
        <CreateMasterPasswordScreen
          busy={store.authBusy}
          serverError={store.authError}
          onSubmit={store.completeRecoverySetup}
        />
      )

    case 'reveal-recovery-key':
    case 'reveal-recovery-key-after-recovery':
      return (
        <RecoveryKeyRevealScreen recoveryKey={store.pendingRecoveryKey ?? ''} onContinue={store.finishRecoveryKeyReveal} />
      )

    case 'unlock':
      return (
        <UnlockScreen
          busy={store.authBusy}
          error={store.authError}
          onSubmit={store.unlock}
          onForgotPassword={store.goToRecoveryUnlock}
        />
      )

    case 'recovery-unlock':
      return (
        <RecoveryUnlockScreen
          busy={store.authBusy}
          error={store.authError}
          onSubmit={store.unlockWithRecovery}
          onBackToPassword={store.goToPasswordUnlock}
        />
      )

    case 'locked':
      return (
        <AutoLockScreen
          busy={store.authBusy}
          error={store.authError}
          lastSection={store.lastSection}
          onSubmit={store.unlock}
          onForgotPassword={store.goToRecoveryUnlock}
        />
      )

    case 'unlocked':
      return <>{children}</>

    default:
      return null
  }
}
