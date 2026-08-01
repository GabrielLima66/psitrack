import { create } from 'zustand'

export type VaultScreen =
  | 'loading'
  | 'create-password'
  | 'reveal-recovery-key'
  | 'unlock'
  | 'recovery-unlock'
  | 'create-password-after-recovery'
  | 'reveal-recovery-key-after-recovery'
  | 'locked'
  | 'unlocked'

const MAX_ATTEMPT_DELAY_MS = 10_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Sugestão do design: depois de 5 tentativas erradas, atraso incremental — nunca bloqueio permanente. */
function delayForAttempt(failedAttempts: number): number {
  if (failedAttempts < 5) return 0
  return Math.min((failedAttempts - 4) * 1000, MAX_ATTEMPT_DELAY_MS)
}

interface VaultStoreState {
  screen: VaultScreen
  authBusy: boolean
  authError: string | null
  failedAttempts: number
  pendingRecoveryKey: string | null
  /** Rótulo genérico pro chip da tela de auto-lock — nunca nome/iniciais de paciente. */
  lastSection: string

  checkStatus: () => Promise<void>
  createPassword: (password: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  unlockWithRecovery: (recoveryKeyInput: string) => Promise<void>
  completeRecoverySetup: (newPassword: string) => Promise<void>
  finishRecoveryKeyReveal: () => void
  goToRecoveryUnlock: () => void
  goToPasswordUnlock: () => void
  onAutoLocked: () => void
  setLastSection: (section: string) => void
}

export const useVaultStore = create<VaultStoreState>((set, get) => ({
  screen: 'loading',
  authBusy: false,
  authError: null,
  failedAttempts: 0,
  pendingRecoveryKey: null,
  lastSection: 'PsiTrack',

  checkStatus: async () => {
    const { exists } = await window.psitrack.vault.status()
    set({ screen: exists ? 'unlock' : 'create-password' })
  },

  createPassword: async (password) => {
    set({ authBusy: true, authError: null })
    const result = await window.psitrack.vault.create(password)
    if (result.ok) {
      set({ authBusy: false, pendingRecoveryKey: result.recoveryKey, screen: 'reveal-recovery-key' })
    } else {
      set({ authBusy: false, authError: result.error })
    }
  },

  unlock: async (password) => {
    const delay = delayForAttempt(get().failedAttempts)
    set({ authBusy: true, authError: null })
    if (delay > 0) await sleep(delay)
    const result = await window.psitrack.vault.unlock(password)
    if (result.ok) {
      set({ authBusy: false, failedAttempts: 0, screen: 'unlocked' })
    } else {
      set((state) => ({ authBusy: false, authError: result.error, failedAttempts: state.failedAttempts + 1 }))
    }
  },

  unlockWithRecovery: async (recoveryKeyInput) => {
    set({ authBusy: true, authError: null })
    const result = await window.psitrack.vault.unlockWithRecovery(recoveryKeyInput)
    if (result.ok) {
      set({ authBusy: false, screen: 'create-password-after-recovery' })
    } else {
      set({ authBusy: false, authError: result.error })
    }
  },

  completeRecoverySetup: async (newPassword) => {
    set({ authBusy: true, authError: null })
    const result = await window.psitrack.vault.completeRecoverySetup(newPassword)
    if (result.ok) {
      set({ authBusy: false, pendingRecoveryKey: result.recoveryKey, screen: 'reveal-recovery-key-after-recovery' })
    } else {
      set({ authBusy: false, authError: result.error })
    }
  },

  finishRecoveryKeyReveal: () => set({ pendingRecoveryKey: null, screen: 'unlocked' }),

  goToRecoveryUnlock: () => set({ authError: null, screen: 'recovery-unlock' }),
  goToPasswordUnlock: () => set({ authError: null, screen: 'unlock' }),

  onAutoLocked: () => set({ screen: 'locked', authError: null }),

  setLastSection: (section) => set({ lastSection: section })
}))
