import {
  UPGRADES,
  pressValue,
  purchaseUpgrade,
  rewardConfirmedPress,
  rollbackPress,
  sanitizeClickerState,
  type ClickerState,
} from './clicker-state.js'
import { CLICK_FUND_AMOUNT, CLICK_SEND_AMOUNT, CLICK_SINK_ADDRESS, CLICK_WORK_PATH } from './clicker-network.js'

const STORAGE_KEY = 'kei-home-clicker-v1'

interface NetworkClient {
  readonly address: string
  balance(): Promise<number>
  faucet(amount?: number | string): Promise<{ hash: string }>
  send(to: string, amount: number | string): Promise<{ hash: string; amount: number; to: string }>
}

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null
}

const cap = byId<HTMLButtonElement>('press-cap')
const rig = byId<HTMLElement>('press-rig')
const image = byId<HTMLImageElement>('press-image')
const count = byId<HTMLElement>('press-count')
const countUnit = byId<HTMLElement>('press-count-unit')
const networkStatus = byId<HTMLElement>('press-network-status')
const localStatus = byId<HTMLElement>('press-local-status')
const shop = byId<HTMLElement>('press-shop')

if (cap && rig && image && count && countUnit && networkStatus && localStatus && shop) {
  let state = loadState()
  let client: NetworkClient | undefined
  let connecting: Promise<NetworkClient> | undefined
  let pending = 0
  let cooldownUntil = 0

  const save = (): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      localStatus.textContent = 'Local progression could not be saved in this browser.'
    }
  }

  const revealShop = (): void => {
    if (state.confirmedPresses < 1) return
    shop.closest('.press')?.classList.add('shop-open')
    shop.classList.add('visible')
    shop.removeAttribute('inert')
    shop.setAttribute('aria-hidden', 'false')
  }

  const render = (): void => {
    count.textContent = String(state.credits)
    countUnit.textContent = state.credits === 1 ? 'click credit' : 'click credits'
    const value = pressValue(state)
    for (const upgrade of UPGRADES) {
      const button = shop.querySelector<HTMLButtonElement>(`[data-upgrade="${upgrade.id}"]`)
      if (!button) continue
      const owned = state.owned.includes(upgrade.id)
      button.disabled = owned || state.credits < upgrade.cost
      button.textContent = owned ? 'Installed' : `Buy · ${upgrade.cost}`
      button.setAttribute(
        'aria-label',
        owned ? `${upgrade.name} installed` : `Buy ${upgrade.name} for ${upgrade.cost} click credits`,
      )
    }
    localStatus.textContent = `Manual press value: ${value}. Shop credits and upgrades stay in this browser.`
    revealShop()
  }

  /**
   * A discrete `img.src` swap tied 1:1 to raw pointer timing means a fast
   * click — pointerdown and pointerup landing in the same frame — never gets
   * the pressed frame scheduled for paint at all. Fixing that takes two
   * things, matching the pattern button/src/world.ts already uses for its 3D
   * cap (`pressedFor`, decremented every frame rather than tied to the
   * pointer directly):
   *
   *   1. The two states are stacked images cross-faded by CSS opacity
   *      (`.press-cap.down`, styles.css) instead of a raster `src` swap, so a
   *      state change is compositor-only.
   *   2. A guaranteed minimum dwell, decoupled from how long the pointer was
   *      actually down: on press, `.down` goes on immediately; on release,
   *      it only comes off immediately if the minimum has already elapsed —
   *      otherwise the removal is deferred to when it will have.
   */
  const PRESS_MIN_DWELL_MS = 100
  let heldSince = 0
  let clearHeldTimer: ReturnType<typeof setTimeout> | undefined

  const setHeld = (held: boolean): void => {
    if (held) {
      if (clearHeldTimer !== undefined) {
        clearTimeout(clearHeldTimer)
        clearHeldTimer = undefined
      }
      heldSince = performance.now()
      cap.classList.add('down')
      return
    }
    if (clearHeldTimer !== undefined) return // already waiting out the minimum
    const remaining = PRESS_MIN_DWELL_MS - (performance.now() - heldSince)
    if (remaining <= 0) {
      cap.classList.remove('down')
      return
    }
    clearHeldTimer = setTimeout(() => {
      clearHeldTimer = undefined
      cap.classList.remove('down')
    }, remaining)
  }

  const showReward = (amount: number): void => {
    const pop = document.createElement('span')
    pop.className = 'pop'
    pop.textContent = `+${amount}`
    pop.style.left = `${44 + Math.random() * 12}%`
    rig.appendChild(pop)
    window.setTimeout(() => pop.remove(), 760)
  }

  const connect = async (): Promise<NetworkClient> => {
    if (client) return client
    // Presses no longer wait on each other (see `press` below), so two of
    // them can both find no client yet — without memoizing the in-flight
    // promise here, that races two `Kei.start()` calls into two different
    // wallets.
    connecting ??= (async () => {
      networkStatus.textContent = 'Connecting a persisted browser wallet to the public Kei testnet…'
      // Keep the ~750 KB wallet/signing SDK off the initial page load. It is
      // fetched only when somebody actually presses the network button.
      const { Kei } = await import('kei-transaction')
      const kei = await Kei.start({
        // Without a work server, `Kei.start()` runs blake2b proof-of-work
        // synchronously on this tab's main thread — a multi-second freeze per
        // press for a `send` block (SPEC §5.5, @keicoin/core's work.ts).
        // `worker/index.ts` answers this path. `createWorkProvider` already
        // falls back to local generation if that Worker is unreachable, so
        // this is safe to point at even if it is not deployed yet.
        workServer: `${location.origin}${CLICK_WORK_PATH}`,
      })
      const balance = await kei.balance()
      if (balance < Number(CLICK_SEND_AMOUNT)) {
        networkStatus.textContent = 'Funding this testnet-only wallet from the public faucet…'
        await kei.faucet(CLICK_FUND_AMOUNT)
      }
      client = kei
      return kei
    })()
    try {
      return await connecting
    } finally {
      connecting = undefined
    }
  }

  const setPending = (delta: number): void => {
    pending += delta
    cap.setAttribute('aria-busy', String(pending > 0))
  }

  // A brief cooldown stops one click registering twice; it does not block
  // presses on the network the way the old full-round-trip `cap.disabled`
  // lock did.
  const PRESS_COOLDOWN_MS = 150

  const press = (): void => {
    const now = performance.now()
    if (now < cooldownUntil) return
    cooldownUntil = now + PRESS_COOLDOWN_MS

    // Optimistic: the credit is granted the instant the button is pressed,
    // not after the account_info → PoW → process round trip confirms it —
    // matching the pattern button/src/economy.ts's press() already uses for
    // its unbanked counter. `submit` reconciles below: on success there is
    // nothing further to do, the chain agreed; on failure the credit is
    // rolled back and the failure is shown.
    const reward = pressValue(state)
    state = rewardConfirmedPress(state)
    save()
    render()
    showReward(reward)
    setPending(1)

    void submit(reward)
  }

  const submit = async (reward: number): Promise<void> => {
    try {
      const kei = await connect()
      networkStatus.textContent = 'Generating work and sending testnet-only Kei to the null account…'
      const receipt = await kei.send(CLICK_SINK_ADDRESS, CLICK_SEND_AMOUNT)
      networkStatus.textContent = `Testnet accepted block ${shortHash(receipt.hash)}. One press credited.`
      networkStatus.title = receipt.hash
    } catch (error) {
      client = undefined
      // Nothing was confirmed, so the optimistic credit was never earned.
      state = rollbackPress(state, reward)
      save()
      render()
      const message = error instanceof Error ? error.message : 'Unknown testnet error.'
      networkStatus.textContent = `No credit added. ${message} Press again to retry.`
      networkStatus.removeAttribute('title')
    } finally {
      setPending(-1)
    }
  }

  setHeld(false)
  render()

  cap.addEventListener('pointerdown', (event) => {
    cap.setPointerCapture?.(event.pointerId)
    setHeld(true)
  })
  cap.addEventListener('pointerup', () => setHeld(false))
  cap.addEventListener('pointercancel', () => setHeld(false))
  cap.addEventListener('lostpointercapture', () => setHeld(false))
  cap.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Enter') setHeld(true)
  })
  cap.addEventListener('keyup', (event) => {
    if (event.key === ' ' || event.key === 'Enter') setHeld(false)
  })
  cap.addEventListener('contextmenu', (event) => event.preventDefault())
  cap.addEventListener('dragstart', (event) => event.preventDefault())
  cap.addEventListener('click', () => press())

  shop.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-upgrade]')
    if (!button) return
    const result = purchaseUpgrade(state, button.dataset.upgrade ?? '')
    if (!result.ok) return
    state = result.state
    save()
    render()
    localStatus.textContent = `${result.upgrade.name} installed locally. Manual presses now earn ${pressValue(state)} credits after testnet acceptance.`
  })
}

function loadState(): ClickerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return sanitizeClickerState(raw ? JSON.parse(raw) : undefined)
  } catch {
    return sanitizeClickerState(undefined)
  }
}

function shortHash(hash: string): string {
  return hash.length > 16 ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : hash
}
