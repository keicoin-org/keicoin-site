export interface Upgrade {
  id: string
  name: string
  cost: number
  bonus: number
  note: string
}

export const UPGRADES: readonly Upgrade[] = [
  { id: 'pusher', name: 'Pusher', cost: 3, bonus: 1, note: '+1 credit per confirmed press' },
  { id: 'fulcrum', name: 'Fulcrum', cost: 12, bonus: 3, note: '+3 credits per confirmed press' },
  { id: 'counterweight', name: 'Counterweight', cost: 45, bonus: 10, note: '+10 credits per confirmed press' },
  { id: 'engine', name: 'Engine', cost: 180, bonus: 35, note: '+35 credits per confirmed press' },
] as const

export interface ClickerState {
  credits: number
  confirmedPresses: number
  owned: string[]
}

export const EMPTY_CLICKER_STATE: ClickerState = {
  credits: 0,
  confirmedPresses: 0,
  owned: [],
}

const safeCount = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0

export function sanitizeClickerState(value: unknown): ClickerState {
  if (!value || typeof value !== 'object') return { ...EMPTY_CLICKER_STATE, owned: [] }
  const candidate = value as Partial<ClickerState>
  const allowed = new Set(UPGRADES.map((upgrade) => upgrade.id))
  const owned = Array.isArray(candidate.owned)
    ? [...new Set(candidate.owned.filter((id): id is string => typeof id === 'string' && allowed.has(id)))]
    : []
  return {
    credits: safeCount(candidate.credits),
    confirmedPresses: safeCount(candidate.confirmedPresses),
    owned,
  }
}

export function pressValue(state: ClickerState): number {
  return 1 + UPGRADES.reduce(
    (total, upgrade) => total + (state.owned.includes(upgrade.id) ? upgrade.bonus : 0),
    0,
  )
}

export function rewardConfirmedPress(state: ClickerState): ClickerState {
  return {
    ...state,
    credits: state.credits + pressValue(state),
    confirmedPresses: state.confirmedPresses + 1,
  }
}

export type PurchaseResult =
  | { ok: true; state: ClickerState; upgrade: Upgrade }
  | { ok: false; reason: 'unknown' | 'owned' | 'cost' }

export function purchaseUpgrade(state: ClickerState, id: string): PurchaseResult {
  const upgrade = UPGRADES.find((candidate) => candidate.id === id)
  if (!upgrade) return { ok: false, reason: 'unknown' }
  if (state.owned.includes(id)) return { ok: false, reason: 'owned' }
  if (state.credits < upgrade.cost) return { ok: false, reason: 'cost' }
  return {
    ok: true,
    upgrade,
    state: {
      ...state,
      credits: state.credits - upgrade.cost,
      owned: [...state.owned, id],
    },
  }
}
