---
title: Offer lifecycle
description: Take one carpet offer from publish to settlement or cancellation, and rebuild a market view from the chain afterwards.
---

# Offer lifecycle

## Outcome

By the end of this page you can walk a single offer through its whole life — publish it, let another wallet discover it, re-read it by hash before acting, accept it atomically or cancel it, and rebuild the view afterwards from `mine()` and `trades()` alone.

::: warning This is today's bilateral offer flow
Everything below is the peer-to-peer offer book that `@keicoin/market` ships now: one seller locks one parcel, one buyer takes it, and the price is whatever those two agreed on. There is **no pool, no bonding curve, and no automated market maker** — the pooled/curve trading UX that Carpet Markets is sometimes asked for does not exist here, and this page does not describe it. An asset nobody has traded has no price at all; `medianPrice()` returns `null` rather than quoting one. See [There is no curve, deliberately](../carpet-markets.md#there-is-no-curve-deliberately).
:::

The chain is the authority for every fact on this page. An offer *is* a `swap_offer` block, and its hash is its id (SPEC §9.3). Anything your UI or server keeps — a listing grid, a "my offers" panel, a price ticker — is a cache you can throw away and rebuild by reading account chains again.

## Before you begin

You need two wallets, an asset the seller actually holds, and Kei in the buyer's wallet. This page uses `Kei.mock()` so it runs with no node:

```ts
import { Kei, KeiError, randomSeed } from 'kei-transaction'

const node = await Kei.mock()
const game = await Kei.server({ seed: 'C'.repeat(64), node })
await game.faucet(20_000)

const seller = await Kei.start({ node, seed: randomSeed() })
const buyer = await Kei.start({ node, seed: randomSeed() })
await Promise.all([game.send(seller.address, 2_000), game.send(buyer.address, 2_000)])
await Promise.all([seller.sync(), buyer.sync()])

const parcel = await game.items.create({ name: 'Carpet Parcel' })
await game.items.mint(parcel.id, seller.address)
await seller.sync()   // a mint is a receivable until the wallet signs for it
```

That last `sync()` is not decoration. Minted assets are owed, not held, until the recipient signs — publish before it and the listing fails with "you hold 0".

## Lifecycle at a glance

![Protocol diagram of the bilateral offer lifecycle: a seller publishes an offer and the give asset locks; an address-scoped buyer UI discovers it, re-reads it by hash and checks that it is still open on the stated terms; from there either an accept settles both legs atomically (give to the buyer, quote to the seller) or a seller cancel releases the locked give; both paths reconcile from mine() and trades(), and a stale cache that races a settled offer gets offer-taken or offer-cancelled back and refreshes.](/img/docs/carpet-offer-lifecycle.svg)

*A protocol diagram, not a screenshot — it describes the current bilateral offer flow, with no pool and no bonding curve anywhere in it. The chain is authoritative: every state in the picture is something you read back from it, not something the UI remembers.*

```
publish ──▶ open ──┬──▶ accepted   (swap_accept: both legs, or neither)
                   └──▶ cancelled  (swap_cancel: the give side comes back)
```

Three blocks, and only three. `open` is the only state anything can be done from, and the transition out of it happens exactly once — whoever's block lands first decides which of the two it was.

## Sell

`sell()` locks the seller's own asset and asks for Kei:

```ts
const offer = await seller.market.sell({ asset: parcel, price: 5 })

offer.hash          // the swap_offer block hash — this is the offer's id
offer.give.amount   // 1
offer.want.symbol   // 'KEI'
offer.price         // 5 — want per one unit of give
offer.to            // null: anyone may accept
offer.state         // 'open'
```

The lock is real and it is the ledger's, not the SDK's:

```ts
await seller.items.owner(parcel.id)   // null — it is not in the spendable balance
await seller.market.sell({ asset: parcel, price: 3 })   // throws insufficient-balance
```

Only the offerer locks anything, and it is their own asset (SPEC §9.2). That single rule is why the same parcel cannot be listed twice, and why "where did my parcel go?" almost always means an offer this wallet already wrote. The error says so, and names how much is locked in your own open offers.

`bid()` is the mirror — it locks Kei out of the buyer's wallet and takes the asset from whoever fills it. `offer({ give, want })` is the general form; `sell` and `bid` are it with Kei on one side.

Reserve a parcel for one buyer, or give the listing an advisory deadline:

```ts
await seller.market.sell({ asset: parcel, price: 5, to: buyer.address })
await seller.market.sell({ asset: parcel, price: 5, expiresIn: '7d' })
```

Pass `expiresIn` or `expiresAt`, never both — both throws `bad-expiry`. A listing reserved for your own address is refused before anything locks.

## Buy

Discovery is address-scoped. There is no network-wide index (SPEC §9.4), so you read the chains of the accounts you name:

```ts
const listings = await buyer.market.offers({
  from: [seller.address, otherSeller.address],   // required
  asset: parcel,                                 // only offers giving this asset
  state: 'open',                                 // the default; null for every state
})
```

Calling `offers()` without `from` throws `no-accounts` on purpose. Your app supplies the address list — in Carpet Markets, the registry is that list.

**Re-read by hash immediately before you act.** A listing you fetched a moment ago may already be gone; `get()` is the cheap authoritative check:

```ts
const fresh = await buyer.market.get(listings[0].hash)   // Offer | null
if (!fresh || fresh.state !== 'open') return             // somebody got there first
```

Then validate what your UI is about to promise, against the freshly read offer rather than the cached row:

```ts
if (fresh.to !== null && fresh.to !== buyer.address) return   // reserved for someone else
if (fresh.from === buyer.address) return                      // your own listing
if (fresh.expired) {
  // Still settleable — the chain has no clock. This is a display choice, not a rule.
}
```

`accept()` re-runs every one of those checks itself and throws rather than writing a bad block, so the checks above are for the interface, not for safety.

```ts
const settlement = await buyer.market.accept(fresh)   // an Offer or a bare hash

settlement.hash       // the swap_accept block — one block, both legs or neither
settlement.offer      // the offer hash it consumed
settlement.received   // what this wallet got
settlement.paid       // what this wallet paid
settlement.price
```

Settlement is atomic (SPEC §9.2): both legs move or nothing does. By the time the promise resolves the wallet has collected both sides, so the asset is in the balance:

```ts
await buyer.items.owner(parcel.id)   // buyer.address
await buyer.balance()                // 2_000 - 5
await seller.sync()
await seller.balance()               // 2_000 + 5
```

Two buyers racing the same offer is a normal event, not an error state: exactly one `accept()` fulfils and the other rejects with `offer-taken`. Both wallets then agree on one owner — `owner()` answers globally, so neither reports itself.

```ts
const results = await Promise.allSettled([buyer.market.accept(offer), eve.market.accept(offer)])
results.filter((r) => r.status === 'fulfilled')   // length 1
```

## Cancel and expire

Only the author can cancel, because nobody else's asset is locked by the offer:

```ts
const cancellation = await seller.market.cancel(offer)
cancellation.returned.asset   // back in the seller's spendable balance
await buyer.market.cancel(offer)   // throws not-your-offer
```

Cancelling something already settled throws `offer-taken` — and the message is the right one for a UI: there is nothing left to cancel, the payment is on its way.

**Accept and cancel race for the same locked entry, and either can win** (SPEC §9.2, conflict 4). Losing is a normal outcome with a plain `KeiError`, and the asset is never stuck — it is with its new owner or back home:

```ts
const results = await Promise.allSettled([buyer.market.accept(offer), seller.market.cancel(offer)])
// exactly one fulfilled, exactly one rejected
const settled = await seller.market.get(offer.hash)
settled?.state   // 'accepted' or 'cancelled' — read it, don't guess from who threw
```

Expiry is advisory. The chain has no clock, so an offer past `expiresAt` **still settles if somebody accepts it**; `Offer.expired` is a hint for the view and never a guarantee:

```ts
const listing = await quiet.market.sell({ asset: parcel, price: 5, expiresIn: '1ms' })
;(await quiet.market.get(listing.hash))?.expired   // true
await buyer.market.accept(listing)                 // and it still works
```

What actually removes a listing is the offerer's own cancel, so somebody has to write one. The SDK writes it in the background by default (`autoCancelExpired`, swept every 30s). Turn that off and sweep by hand when your process owns the schedule:

```ts
const quiet = await Kei.start({ node, seed: randomSeed(), autoCancelExpired: false })
const swept = await quiet.market.cancelExpired()   // Cancellation[], this wallet's own only
```

`cancelExpired()` only touches offers this wallet wrote, skips anything not yet expired, and swallows `offer-taken` / `offer-cancelled` as it goes — losing that race means it sold, which is not a failure. Calling it twice is safe; the second call returns `[]`.

## Reconcile

Your cache is rebuildable, so rebuild it rather than patching it. Two reads cover the whole picture:

- `mine({ state: null })` — every offer this wallet wrote, in every state, expired ones included by default (those are exactly the ones you need to see).
- `trades()` — settled offers only, which is the only price history a chain can have (SPEC §9.1). Every element has `state: 'accepted'` plus `seller` and `buyer`. A still-open listing is not a trade, and `medianPrice()` on an asset that never sold is `null`.

A refresh that is safe to call on a timer, after a click, or after a failed write — it reads current state and never assumes what it previously showed:

```ts
async function refresh(wallet: Kei, sellers: readonly string[]) {
  try {
    const [open, own, history] = await Promise.all([
      wallet.market.offers({ from: sellers, state: 'open' }),
      wallet.market.mine({ state: null }),
      wallet.market.trades({ from: sellers, window: '7d' }),
    ])
    return { open, own, history, ok: true as const }
  } catch (error) {
    // A failed refresh changes nothing on the chain. Keep the last view and retry.
    if (error instanceof KeiError) return { ok: false as const, code: error.code }
    throw error
  }
}
```

Because it re-reads instead of mutating, calling it twice concurrently is harmless and calling it after a lost race is exactly right. Apply the same rule to writes: when `accept()` or `cancel()` throws `offer-taken` or `offer-cancelled`, do not retry that hash — refresh, and let the new state pick the next action.

`trades()` and `price()` default to **this wallet's own** trades, so pass `{ from }` when you are drawing somebody else's book, or an untraded wallet reads as an asset with no history. `settledAt` and `seenAt` are node-local first-seen times, not consensus — fine for a `window` filter, not something to reconcile against.

## State and errors

| State | Set by | Locked asset | What you can do |
| --- | --- | --- | --- |
| `open` | `swap_offer` | held by the ledger, out of the author's spendable balance | accept (anyone, or `to` only), cancel (author only) |
| `accepted` | `swap_accept` | moved to the buyer; payment moved to the author | nothing — an offer settles exactly once |
| `cancelled` | `swap_cancel` | returned to the author | nothing — publish a new offer |

`expired` is not a state. It is a computed flag on an open offer whose advisory `expiresAt` has passed, and such an offer is still fully acceptable.

The codes worth branching on here: `offer-taken` and `offer-cancelled` (someone won the race — refresh, don't retry), `not-the-counterparty` and `not-your-offer` (wrong wallet for this action), `no-such-offer` (hash never existed on this network), `insufficient-balance` (usually your own open offer holding the lock). The full table lives in the [Market API](./api.md#state-and-errors).

## Test it

The mock ledger enforces the self-locking rule, atomic settlement, and the race the same way a node does, so the lifecycle is testable with no network:

```ts
import { expect, test } from 'bun:test'
import { Kei, randomSeed } from 'kei-transaction'

test('an offer goes open → accepted exactly once, and the price is readable after', async () => {
  const node = await Kei.mock()
  const game = await Kei.server({ seed: 'C'.repeat(64), node })
  await game.faucet(20_000)

  const seller = await Kei.start({ node, seed: randomSeed() })
  const buyer = await Kei.start({ node, seed: randomSeed() })
  const eve = await Kei.start({ node, seed: randomSeed() })
  await Promise.all([seller, buyer, eve].map((w) => game.send(w.address, 2_000)))
  await Promise.all([seller.sync(), buyer.sync(), eve.sync()])

  const parcel = await game.items.create({ name: 'Carpet Parcel' })
  await game.items.mint(parcel.id, seller.address)
  await seller.sync()

  const offer = await seller.market.sell({ asset: parcel, price: 5 })
  expect(await seller.items.owner(parcel.id)).toBeNull()          // genuinely locked

  expect(await buyer.market.offers({ from: seller.address })).toHaveLength(1)
  expect((await buyer.market.get(offer.hash))?.state).toBe('open')

  await buyer.market.accept(offer)
  expect(await buyer.items.owner(parcel.id)).toBe(buyer.address)
  await expect(eve.market.accept(offer)).rejects.toThrow(/already accepted/i)

  expect((await seller.market.mine({ state: null }))[0]?.state).toBe('accepted')
  expect(await seller.market.medianPrice(parcel)).toBe(5)
})
```

To pin the race itself, settle both writers and assert the chain rather than the thrower:

```ts
const results = await Promise.allSettled([buyer.market.accept(offer), seller.market.cancel(offer)])
expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
expect(['accepted', 'cancelled']).toContain((await seller.market.get(offer.hash))?.state ?? '')
```

To test expiry without timers, pass your own clock: `createMarket(client, { now })`, or `autoCancelExpired: false` so the background sweep does not race your assertions.

The same sequence runs unchanged against a real node over HTTP — wallets that share nothing but a URL list, settle, and read the price back off the chain, and offering more units than remain is still refused there.

## Next steps

- [Carpet Markets](../carpet-markets.md) — the worked demo this lifecycle drives, and what the server is still for.
- [Market API](./api.md) — every signature, option, and error code for these calls.
- [Future pool design (proposal)](./future-pool-design.md) — the pooled/curve UX this page says does not exist, written up as a proposal with its costs.
