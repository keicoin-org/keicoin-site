import { describe, expect, test } from 'bun:test'

import {
  EMPTY_CLICKER_STATE,
  pressValue,
  purchaseUpgrade,
  rewardConfirmedPress,
  sanitizeClickerState,
} from './clicker-state.js'

describe('homepage clicker progression', () => {
  test('rewards only the base credit before an upgrade', () => {
    expect(rewardConfirmedPress(EMPTY_CLICKER_STATE)).toEqual({
      credits: 1,
      confirmedPresses: 1,
      owned: [],
    })
  })

  test('Pusher costs three credits and adds one to later presses', () => {
    const bought = purchaseUpgrade({ credits: 3, confirmedPresses: 3, owned: [] }, 'pusher')
    expect(bought.ok).toBe(true)
    if (!bought.ok) return
    expect(bought.state.credits).toBe(0)
    expect(pressValue(bought.state)).toBe(2)
    expect(rewardConfirmedPress(bought.state).credits).toBe(2)
  })

  test('rejects unaffordable and duplicate purchases', () => {
    expect(purchaseUpgrade(EMPTY_CLICKER_STATE, 'pusher')).toEqual({ ok: false, reason: 'cost' })
    expect(purchaseUpgrade({ credits: 10, confirmedPresses: 1, owned: ['pusher'] }, 'pusher')).toEqual({
      ok: false,
      reason: 'owned',
    })
  })

  test('sanitizes persisted state instead of trusting page storage', () => {
    expect(sanitizeClickerState({
      credits: -12,
      confirmedPresses: 4.5,
      owned: ['pusher', 'pusher', 'made-up', 4],
    })).toEqual({ credits: 0, confirmedPresses: 0, owned: ['pusher'] })
  })
})
