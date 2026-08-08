import { useEffect, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
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
  const store = useVaultStore(
    useShallow((s) => ({
      screen: s.screen,
      authBusy: s.authBusy,
      authError: s.authError,
      pendingRecoveryKey: s.pendingRecoveryKey,
      lastSection: s.lastSection,
      checkStatus: s.checkStatus,
      onAutoLocked: s.onAutoLocked,
      unlock: s.unlock,
      unlockWithRecovery: s.unlockWithRecovery,
      createPassword: s.createPassword,
      completeRecoverySetup: s.completeRecoverySetup,
      finishRecoveryKeyReveal: s.finishRecoveryKeyReveal,
      goToRecoveryUnlock: s.goToRecoveryUnlock,
      goToPasswordUnlock: s.goToPasswordUnlock
    }))
  )

  useEffect(() => {
    void store.checkStatus()
    return window.psitrack.vault.onLocked(() => store.onAutoLocked())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 'unlocked' e 'locked' mantêm `children` montado o tempo todo — o
  // auto-lock é uma sobreposição visual, não uma troca de tela. Desmontar o
  // app perderia o estado em memória de um formulário aberto e sujo (rascunho
  // não é persistido em disco de propósito — "voltar exatamente de onde
  // parou" só funciona se o React nunca desmontar a árvore por baixo).
  if (store.screen === 'unlocked' || store.screen === 'locked') {
    return (
      <>
        {children}
        {store.screen === 'locked' && (
          <div className="fixed inset-0 z-50">
            <AutoLockScreen
              busy={store.authBusy}
              error={store.authError}
              lastSection={store.lastSection}
              onSubmit={store.unlock}
              onForgotPassword={store.goToRecoveryUnlock}
            />
          </div>
        )}
      </>
    )
  }

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

    default:
      return null
  }
}
