import {
  UPGRADES,
  pressValue,
  purchaseUpgrade,
  rewardConfirmedPress,
  sanitizeClickerState,
  type ClickerState,
} from './clicker-state.js'
import { CLICK_FUND_AMOUNT, CLICK_SEND_AMOUNT, CLICK_SINK_ADDRESS } from './clicker-network.js'

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
  let busy = false

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

  const setHeld = (held: boolean): void => {
    cap.classList.toggle('down', held)
    image.src = held ? image.dataset.pressed ?? image.src : image.dataset.unpressed ?? image.src
  }

  const setBusy = (next: boolean): void => {
    busy = next
    cap.disabled = next
    cap.setAttribute('aria-busy', String(next))
    if (!next) setHeld(false)
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
    networkStatus.textContent = 'Connecting a persisted browser wallet to the public Kei testnet…'
    // Keep the ~750 KB wallet/signing SDK off the initial page load. It is
    // fetched only when somebody actually presses the network button.
    const { Kei } = await import('kei-transaction')
    client = await Kei.start()
    const balance = await client.balance()
    if (balance < Number(CLICK_SEND_AMOUNT)) {
      networkStatus.textContent = 'Funding this testnet-only wallet from the public faucet…'
      await client.faucet(CLICK_FUND_AMOUNT)
    }
    return client
  }

  const press = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setHeld(false)
    try {
      const kei = await connect()
      networkStatus.textContent = 'Generating work and sending testnet-only Kei to the null account…'
      const receipt = await kei.send(CLICK_SINK_ADDRESS, CLICK_SEND_AMOUNT)
      const reward = pressValue(state)
      state = rewardConfirmedPress(state)
      save()
      render()
      showReward(reward)
      networkStatus.textContent = `Testnet accepted block ${shortHash(receipt.hash)}. One press credited.`
      networkStatus.title = receipt.hash
    } catch (error) {
      client = undefined
      const message = error instanceof Error ? error.message : 'Unknown testnet error.'
      networkStatus.textContent = `No credit added. ${message} Press again to retry.`
      networkStatus.removeAttribute('title')
    } finally {
      setBusy(false)
    }
  }

  new Image().src = image.dataset.pressed ?? ''
  setHeld(false)
  render()

  cap.addEventListener('pointerdown', (event) => {
    if (cap.disabled) return
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
  cap.addEventListener('click', () => void press())

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
