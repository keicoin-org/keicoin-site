import { describe, expect, test } from 'bun:test'

import {
  EMPTY_CLICKER_STATE,
  creditConfirmedPress,
  creditReadout,
  pressValue,
  purchaseUpgrade,
  readoutAnnouncement,
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

  test('the visible total is confirmed plus pending, and the split names both', () => {
    expect(creditReadout({ credits: 4, confirmedPresses: 4, owned: [] }, 3)).toEqual({
      total: 7,
      available: 4,
      pending: 3,
      unit: 'click credits',
    })
    expect(creditReadout(EMPTY_CLICKER_STATE, 1).unit).toBe('click credit')
  })

  test('a press moves the total immediately without moving buying power', () => {
    const settled: ClickerState = { credits: 2, confirmedPresses: 2, owned: [] }
    const reward = pressValue(settled)

    // The press is in flight: the total the page shows goes up, available does
    // not, and the Pusher's 3 credits are still out of reach.
    const pressed = creditReadout(settled, reward)
    expect(pressed.total).toBe(3)
    expect(pressed.available).toBe(2)
    expect(purchaseUpgrade(settled, 'pusher')).toEqual({ ok: false, reason: 'cost' })
  })

  test('acceptance moves one press across the split without the total moving', () => {
    const settled: ClickerState = { credits: 5, confirmedPresses: 5, owned: [] }
    // Two presses of different value in flight — an upgrade was installed
    // between them — and the first of them lands.
    const stillFlying = 1
    const landing = 4
    const before = creditReadout(settled, stillFlying + landing)
    expect(before).toMatchObject({ total: 10, available: 5, pending: 5 })

    const after = creditReadout(creditConfirmedPress(settled, landing), stillFlying)
    expect(after).toMatchObject({ total: 10, available: 9, pending: 1 })

    // Exactly that reward crossed over: no double count, no dip.
    expect(after.total).toBe(before.total)
    expect(after.available - before.available).toBe(landing)
    expect(before.pending - after.pending).toBe(landing)
  })

  test('a failed press rolls the total back and leaves confirmed alone', () => {
    const settled: ClickerState = { credits: 5, confirmedPresses: 5, owned: [] }
    const failed = 4
    const pending = 1 + failed

    const rolledBack = creditReadout(settled, pending - failed)
    expect(rolledBack).toMatchObject({ total: 6, available: 5, pending: 1 })
    expect(rolledBack.available).toBe(settled.credits)
  })

  test('pending never becomes spendable, however much of it there is', () => {
    // Enough pending to cover the Engine twice over, and the workshop still
    // reads confirmed credits only.
    expect(creditReadout(EMPTY_CLICKER_STATE, 400).total).toBe(400)
    expect(purchaseUpgrade(EMPTY_CLICKER_STATE, 'engine')).toEqual({ ok: false, reason: 'cost' })
  })

  test('announces the total once, and names pending only when there is any', () => {
    expect(readoutAnnouncement(creditReadout({ credits: 4, confirmedPresses: 4, owned: [] }, 3)))
      .toBe('7 click credits: 4 available, 3 awaiting the testnet.')
    expect(readoutAnnouncement(creditReadout({ credits: 1, confirmedPresses: 1, owned: [] }, 0)))
      .toBe('1 click credit, 1 available.')
  })

  test('pending survives no reload, because it was never in what gets saved', () => {
    const saved: ClickerState = { credits: 6, confirmedPresses: 6, owned: ['pusher'] }
    const reloaded = sanitizeClickerState(JSON.parse(JSON.stringify(saved)))
    expect(reloaded).toEqual(saved)
    // Whatever was in flight when the tab closed is gone, so the page opens
    // showing only what the testnet accepted.
    expect(creditReadout(reloaded, 0)).toMatchObject({ total: 6, available: 6, pending: 0 })
  })

  test('sanitizes persisted state instead of trusting page storage', () => {
    expect(sanitizeClickerState({
      credits: -12,
      confirmedPresses: 4.5,
      owned: ['pusher', 'pusher', 'made-up', 4],
    })).toEqual({ credits: 0, confirmedPresses: 0, owned: ['pusher'] })
  })
})
