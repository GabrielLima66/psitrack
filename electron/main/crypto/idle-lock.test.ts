import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startAutoLock } from './idle-lock'

describe('startAutoLock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('não chama onLock enquanto a ociosidade fica abaixo do limiar', () => {
    const onLock = vi.fn()
    let idleSeconds = 0
    const handle = startAutoLock({
      getIdleSeconds: () => idleSeconds,
      onLock,
      thresholdSeconds: 300,
      pollIntervalMs: 1000
    })

    idleSeconds = 299
    vi.advanceTimersByTime(5000)
    expect(onLock).not.toHaveBeenCalled()

    handle.stop()
  })

  it('chama onLock assim que a ociosidade cruza o limiar', () => {
    const onLock = vi.fn()
    let idleSeconds = 0
    const handle = startAutoLock({
      getIdleSeconds: () => idleSeconds,
      onLock,
      thresholdSeconds: 300,
      pollIntervalMs: 1000
    })

    idleSeconds = 300
    vi.advanceTimersByTime(1000)
    expect(onLock).toHaveBeenCalledTimes(1)

    handle.stop()
  })

  it('stop() para de pollar', () => {
    const onLock = vi.fn()
    const handle = startAutoLock({
      getIdleSeconds: () => 1000,
      onLock,
      thresholdSeconds: 300,
      pollIntervalMs: 1000
    })

    handle.stop()
    vi.advanceTimersByTime(10000)
    expect(onLock).not.toHaveBeenCalled()
  })
})
