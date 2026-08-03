import { describe, expect, test } from 'bun:test'

import {
  EMPTY_CLICKER_STATE,
  creditConfirmedPress,
  pressValue,
  purchaseUpgrade,
  sanitizeClickerState,
  type ClickerState,
} from './clicker-state.js'

describe('homepage clicker progression', () => {
  test('rewards only the base credit before an upgrade', () => {
    expect(creditConfirmedPress(EMPTY_CLICKER_STATE, pressValue(EMPTY_CLICKER_STATE))).toEqual({
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
    expect(creditConfirmedPress(bought.state, pressValue(bought.state)).credits).toBe(2)
  })

  test('rejects unaffordable and duplicate purchases', () => {
    expect(purchaseUpgrade(EMPTY_CLICKER_STATE, 'pusher')).toEqual({ ok: false, reason: 'cost' })
    expect(purchaseUpgrade({ credits: 10, confirmedPresses: 1, owned: ['pusher'] }, 'pusher')).toEqual({
      ok: false,
      reason: 'owned',
    })
  })

  test('a press still in flight lands at what it was worth when it was made', () => {
    const before: ClickerState = { credits: 3, confirmedPresses: 3, owned: [] }
    const inFlight = pressValue(before)

    const bought = purchaseUpgrade(before, 'pusher')
    expect(bought.ok).toBe(true)
    if (!bought.ok) return

    // Installing Pusher while that press is unsettled does not retroactively
    // raise what the testnet owes for it: 1 was pressed for, 1 is credited.
    expect(creditConfirmedPress(bought.state, inFlight).credits).toBe(1)
  })

  test('an upgrade cannot be bought with presses that have not landed', () => {
    // Three presses in flight are worth the Pusher's 3 credits and buy nothing,
    // because unsettled presses are held outside the state the workshop spends.
    // Only once the chain has accepted them do they become buying power.
    expect(purchaseUpgrade(EMPTY_CLICKER_STATE, 'pusher')).toEqual({ ok: false, reason: 'cost' })

    let settled = EMPTY_CLICKER_STATE
    for (let press = 0; press < 3; press++) settled = creditConfirmedPress(settled, 1)

    expect(settled.credits).toBe(3)
    expect(purchaseUpgrade(settled, 'pusher').ok).toBe(true)
  })

  test('sanitizes persisted state instead of trusting page storage', () => {
    expect(sanitizeClickerState({
      credits: -12,
      confirmedPresses: 4.5,
      owned: ['pusher', 'pusher', 'made-up', 4],
    })).toEqual({ credits: 0, confirmedPresses: 0, owned: ['pusher'] })
  })
})
