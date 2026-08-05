import {
  UPGRADES,
  creditConfirmedPress,
  creditReadout,
  pressValue,
  purchaseUpgrade,
  readoutAnnouncement,
  sanitizeClickerState,
  type ClickerState,
} from './clicker-state.js'
import {
  CLICK_FUND_AMOUNT,
  CLICK_GRANT_PATH,
  CLICK_SEND_AMOUNT,
  CLICK_SINK_ADDRESS,
  CLICK_WORK_PATH,
} from './clicker-network.js'
import { openWorkGrant, renewDelayMs } from './work-challenge.js'

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
const available = byId<HTMLElement>('press-available')
const pendingOut = byId<HTMLElement>('press-pending')
const split = byId<HTMLElement>('press-split')
const creditStatus = byId<HTMLElement>('press-credit-status')
const networkStatus = byId<HTMLElement>('press-network-status')
const localStatus = byId<HTMLElement>('press-local-status')
const shop = byId<HTMLElement>('press-shop')
const challenge = byId<HTMLElement>('press-challenge')

/**
 * Cloudflare's widget, loaded from `challenges.cloudflare.com`. Deliberately
 * `any`-shaped: the alternative is restating Cloudflare's API in a `.d.ts` this
 * repo would then own and have to keep true.
 */
interface Turnstile {
  render(
    container: HTMLElement,
    options: {
      sitekey: string
      appearance?: string
      callback(token: string): void
      'error-callback'?(): void
      'expired-callback'?(): void
    },
  ): string
  reset(widget: string): void
  remove(widget: string): void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let turnstileScript: Promise<Turnstile> | undefined

/**
 * Fetched on the first press, not on page load. The site is text and it should
 * cost a reader nothing to read it; only somebody who has asked the work
 * server for something pays for this.
 */
function loadTurnstile(): Promise<Turnstile> {
  turnstileScript ??= new Promise<Turnstile>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile)
    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT
    script.async = true
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile loaded without an API.'))
    script.onerror = () => reject(new Error('Turnstile could not be loaded.'))
    document.head.appendChild(script)
  })
  return turnstileScript
}

if (
  cap && rig && image && count && countUnit && available && pendingOut && split &&
  creditStatus && networkStatus && localStatus && shop && challenge
) {
  let state = loadState()
  let client: NetworkClient | undefined
  let connecting: Promise<NetworkClient> | undefined
  let pending = 0
  // Credits pressed for and not yet accepted by the testnet. Deliberately not
  // part of `state`: `state` is what gets written to localStorage and what the
  // workshop spends, and an unsettled credit belongs in neither.
  let pendingCredits = 0
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
    // The big number moves the moment a press is made, so the button feels like
    // it did something; the split under it is what keeps that honest, naming
    // how much of the total the testnet has actually accepted. The visual
    // numbers are aria-hidden and a single composed sentence goes to the live
    // region instead, so three changing nodes are not announced three times.
    const readout = creditReadout(state, pendingCredits)
    count.textContent = String(readout.total)
    countUnit.textContent = readout.unit
    available.textContent = String(readout.available)
    pendingOut.textContent = String(readout.pending)
    split.classList.toggle('has-pending', readout.pending > 0)
    const announcement = readoutAnnouncement(readout)
    if (creditStatus.textContent !== announcement) creditStatus.textContent = announcement
    const value = pressValue(state)
    for (const upgrade of UPGRADES) {
      const button = shop.querySelector<HTMLButtonElement>(`[data-upgrade="${upgrade.id}"]`)
      if (!button) continue
      const owned = state.owned.includes(upgrade.id)
      button.disabled = owned || state.credits < upgrade.cost
      button.textContent = owned ? 'Installed' : `Buy Â· ${upgrade.cost}`
      button.setAttribute(
        'aria-label',
        owned ? `${upgrade.name} installed` : `Buy ${upgrade.name} for ${upgrade.cost} click credits`,
      )
    }
    // No pending count here â€” the split above says it, and repeating it in a
    // second place is what makes a readout read as noise.
    localStatus.textContent = `Manual press value: ${value}. Only available credits can be spent in the workshop; pending ones are still with the testnet.`
    revealShop()
  }

  /**
   * A discrete `img.src` swap tied 1:1 to raw pointer timing means a fast
   * click â€” pointerdown and pointerup landing in the same frame â€” never gets
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
   *      it only comes off immediately if the minimum has already elapsed â€”
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

  let widget: string | undefined
  let renewTimer: ReturnType<typeof setTimeout> | undefined

  /**
   * Draws the challenge and resolves with a solved token. In
   * `interaction-only` mode the widget stays invisible unless Cloudflare
   * decides this visitor has to do something, so the common case adds nothing
   * to the page.
   */
  // Held outside the promise because the widget is rendered once and reset for
  // each renewal, so its callbacks outlive the promise that created them and
  // must settle whichever one is currently waiting.
  let pendingChallenge: { resolve(token: string): void; reject(reason: Error): void } | undefined

  const solveChallenge = async (sitekey: string): Promise<string> => {
    const turnstile = await loadTurnstile()
    return new Promise<string>((resolve, reject) => {
      pendingChallenge = { resolve, reject }
      if (widget !== undefined) {
        // `render` into a container that already holds a widget leaves two.
        turnstile.reset(widget)
        return
      }
      widget = turnstile.render(challenge, {
        sitekey,
        appearance: 'interaction-only',
        callback: (token) => pendingChallenge?.resolve(token),
        'error-callback': () => pendingChallenge?.reject(new Error('The challenge could not be completed.')),
        'expired-callback': () => pendingChallenge?.reject(new Error('The challenge expired.')),
      })
    })
  }

  /**
   * A grant lasts 15 minutes; this renews it a minute early so a long session
   * never discovers the expiry as a failed press. A renewal that fails is not
   * reported â€” the SDK falls back to generating work in the tab, which is
   * slower and still correct.
   */
  const scheduleRenewal = (expiresAt: number): void => {
    if (renewTimer !== undefined) clearTimeout(renewTimer)
    renewTimer = setTimeout(() => {
      void openWorkGrant(CLICK_GRANT_PATH, { fetch: window.fetch.bind(window), solve: solveChallenge }).then(
        (renewed) => {
          if (renewed.ok) scheduleRenewal(renewed.expiresAt)
        },
      )
    }, renewDelayMs(expiresAt, Date.now()))
  }

  const connect = async (): Promise<NetworkClient> => {
    if (client) return client
    // Presses no longer wait on each other (see `press` below), so two of
    // them can both find no client yet â€” without memoizing the in-flight
    // promise here, that races two `Kei.start()` calls into two different
    // wallets.
    connecting ??= (async () => {
      // Without a work server, `Kei.start()` runs blake2b proof-of-work
      // synchronously on this tab's main thread â€” a visible freeze per press
      // for a `send` block (SPEC Â§5.5, @keicoin/core's work.ts). The site
      // runs one, but it does not run it for strangers: since
      // keicoin-org/keicoin-site#45 the endpoint wants a Turnstile solve
      // first (`worker/work-gate.ts` says why it is that and not an IP or a
      // bundled token).
      networkStatus.textContent = 'Asking the work server for a grantâ€¦'
      const grant = await openWorkGrant(CLICK_GRANT_PATH, {
        fetch: window.fetch.bind(window),
        solve: solveChallenge,
      })
      if (grant.ok) scheduleRenewal(grant.expiresAt)

      networkStatus.textContent = grant.ok
        ? 'Connecting a persisted browser wallet to the public Kei testnetâ€¦'
        : 'Connecting a persisted browser wallet. Work will be generated in this tab, so presses will be slower.'

      // Keep the ~750 KB wallet/signing SDK off the initial page load. It is
      // fetched only when somebody actually presses the network button.
      const { Kei } = await import('kei-transaction')
      const kei = await Kei.start({
        // Only pointed at the work server when there is a grant to spend
        // there. `createWorkProvider` would fall back to local generation on
        // its own, but it would pay a rejected round trip per press to find
        // that out every time.
        ...(grant.ok ? { workServer: `${location.origin}${CLICK_WORK_PATH}` } : {}),
      })
      const balance = await kei.balance()
      if (balance < Number(CLICK_SEND_AMOUNT)) {
        networkStatus.textContent = 'Funding this testnet-only wallet from the public faucetâ€¦'
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

    // The reward joins `pendingCredits`, not `state.credits`. The big number
    // moves now â€” a press that changes nothing on screen feels broken â€” but it
    // moves by adding to the *pending* half of the split, which is labelled as
    // still being with the testnet. Nothing spendable is granted here, because
    // a granted credit cannot be unwound honestly once the workshop has spent
    // it. `submit` settles it when the chain agrees.
    const reward = pressValue(state)
    pendingCredits += reward
    setPending(1)
    render()

    void submit(reward)
  }

  const submit = async (reward: number): Promise<void> => {
    try {
      const kei = await connect()
      networkStatus.textContent = 'Generating work and sending testnet-only Kei to the null accountâ€¦'
      const receipt = await kei.send(CLICK_SINK_ADDRESS, CLICK_SEND_AMOUNT)
      // The block is on the chain, so the credit is earned. Exactly this
      // press's reward moves from pending to confirmed in one step, so the
      // visible total neither jumps twice nor dips while other presses are
      // still in flight. Credited by what this press was worth when it was
      // made rather than what it would be worth now, because an upgrade can be
      // installed while it is in flight.
      pendingCredits -= reward
      state = creditConfirmedPress(state, reward)
      save()
      render()
      showReward(reward)
      networkStatus.textContent = `Testnet accepted block ${shortHash(receipt.hash)}. ${reward === 1 ? '1 credit' : `${reward} credits`} added.`
      networkStatus.title = receipt.hash
    } catch (error) {
      client = undefined
      // Nothing was written, so nothing is owed. Only the pending half rolls
      // back; confirmed credits are untouched, and the total falls by exactly
      // what this press had been showing as unsettled.
      pendingCredits -= reward
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
  return hash.length > 16 ? `${hash.slice(0, 8)}â€¦${hash.slice(-6)}` : hash
}
