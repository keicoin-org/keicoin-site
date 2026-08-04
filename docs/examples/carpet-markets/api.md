---
title: Market API
description: The @keicoin/market quickstart — list, accept, cancel, and read price history off account chains.
---

# Market API

## Outcome

By the end of this page you can list an asset for Kei, accept somebody else's listing atomically, cancel your own, and read a price off settled blocks — with no listing table, no matching engine, and no server.

An offer *is* a `swap_offer` block (SPEC §9.3). `sell()` writes the block that locks the seller's own asset, `accept()` writes one block that moves both legs or neither, and `cancel()` writes the block that gives the asset back. Everything you read here is read from account chains.

| Concern | Authority |
| --- | --- |
| Offer terms and locked asset | The seller's signed `swap_offer` block. |
| Settlement | One buyer-signed `swap_accept`; both legs move or neither does. |
| Cancellation | The seller's `swap_cancel`; only the author can release the lock. |
| Which seller accounts to inspect | Your app or registry. Kei ships no global indexer. |
| Matching, curves, automated pricing | Not part of this API. |

## Run the smallest complete market

The playground below creates two wallets on `Kei.mock()`, mints a unique item,
lists it for 5 Kei, discovers the listing from the seller's account, accepts it,
and asserts ownership, balance, settled state, and median price.

```sh
bun install --frozen-lockfile
bun run docs/playgrounds/market.ts
# {"kind":"market","offer":"accepted","price":5,"buyerOwnsItem":true}
```

It is the checked-in file the command and docs-playground regression test both
execute, not a shortened version maintained separately from its proof.

<<< ../../playgrounds/market.ts

![Protocol diagram of a seller publishing an offer, then exactly one atomic accept or seller cancellation, followed by reconciliation from the account chains.](/img/docs/carpet-offer-lifecycle.svg)

*This is a protocol diagram, not a product screenshot. The running
[Carpet Markets demo](/examples/carpet-markets) puts a deliberately incomplete
interface around this flow on a no-value mock chain; the diagram and playground
show the ledger behavior the interface is meant to expose.*

## Before you begin

```sh
bun add kei-transaction        # or npm / pnpm / yarn
```

`@keicoin/market` ships separately for bundle size, not as a puzzle to solve — install `kei-transaction` unless you are counting bytes.

Every wallet from `Kei.start()` already exposes the market:

```ts
import { Kei, randomSeed } from 'kei-transaction'

const node = await Kei.mock()
const alice = await Kei.start({ node, seed: randomSeed() })

alice.market // MarketApi
```

If you are wiring a client yourself, the package's own entry point is:

```ts
import { createMarket } from '@keicoin/market'
import type { MarketApi, Offer, Settlement, Trade, PriceSummary } from '@keicoin/market'

const market = createMarket(client, {
  autoCancelExpired: true,   // default
  sweepInterval: 30_000,     // ms, default
  now: Date.now,             // replaceable so a test needs no timers
})
```

Amounts across this API are plain decimal numbers (SPEC §6.1) — raw units and asset ids belong to the node, not to the developer pricing a sword.

## Open the market

`createMarket(client, options?)` returns a `MarketApi`. The background expiry sweep is what makes `close()` matter:

```ts
market.close()   // stops the sweep; Kei.close() calls this for you
```

## Create offers

Three writers, one shape underneath. `sell` and `bid` are `offer` with Kei on one side.

```ts
sell(options: SellOptions): Promise<Offer>
bid(options: BidOptions): Promise<Offer>
offer(options: OfferOptions): Promise<Offer>
```

```ts
// Seller: locks the item, asks 5 Kei
const listing = await alice.market.sell({ asset: sword, price: 5 })
listing.give.amount   // 1
listing.want.symbol   // 'KEI'
listing.price         // 5 — want per one unit of give
listing.to            // null: anyone may accept

// Buyer: the mirror — locks 5 Kei out of this wallet until it settles
await bob.market.bid({ asset: sword, price: 5 })

// Any asset for any asset
await alice.market.offer({
  give: { asset: sword, amount: 1 },
  want: { asset: coin, amount: 40 },
})
```

`asset` takes an asset id or anything with an `id`, so an `Item` or a token works directly. `amount` defaults to `1` — the item case.

::: warning `sell({ amount, price })` takes the total ask, not the price each
The returned `Offer.price` is *per unit*, so the two differ by `amount`. On a coin with a million units, getting this backwards mislists by orders of magnitude.
:::

Reserve a listing for one buyer with `to`, and give it an advisory expiry with `expiresIn` (a duration like `'7d'`, `'90m'`, `'1ms'`) or `expiresAt` (a `Date` or ms timestamp) — one or the other, never both:

```ts
await alice.market.sell({ asset: sword, price: 5, to: bob.address })
await alice.market.sell({ asset: sword, price: 5, expiresIn: '7d' })
```

An offer reserved for your own address is refused before anything locks.

## Read and accept

```ts
get(hash: string): Promise<Offer | null>
offers(options: ListOptions): Promise<Offer[]>
mine(options?: MineOptions): Promise<Offer[]>
accept(offer: string | Offer): Promise<Settlement>
cancel(offer: string | Offer): Promise<Cancellation>
cancelExpired(): Promise<Cancellation[]>
trades(options?: TradeOptions): Promise<Trade[]>
medianPrice(asset, options?): Promise<number | null>
price(asset, options?): Promise<PriceSummary | null>
```

An offer's hash **is** its id — the `swap_offer` block's hash. Read it from `offers()` rather than typing one:

```ts
const listings = await bob.market.offers({ from: alice.address })
const settlement = await bob.market.accept(listings[0])
settlement.received.asset   // the sword
settlement.paid.amount      // 5
settlement.price            // 5

// A bare hash works too
await bob.market.accept(listing.hash)
```

`accept()` is one block, both legs or neither (SPEC §9.2). By the time the promise resolves the wallet has collected both sides, so the item is in the balance.

Cancel returns exactly what was locked, and only the author may write it:

```ts
const cancellation = await alice.market.cancel(listing)
cancellation.returned.asset   // back in alice's spendable balance
```

`get()` reads one offer by hash and returns `null` for one that never existed. `mine()` is this wallet's own offers — it includes expired ones by default, because those are exactly the ones you need to see; pass `{ state: null }` for every state.

Price history is settled offers, nothing else:

```ts
await alice.market.trades()                       // Trade[]; every state === 'accepted'
await alice.market.medianPrice(sword)             // 4, or null if never sold
await alice.market.price(sword)                   // { median, last, low, high, trades, volume }
await alice.market.medianPrice(sword, { window: '7d' })
```

A still-open listing is not a trade: `medianPrice()` on it is `null` and `trades()` is `[]`. `trades()` and `price()` default to **this wallet's own** trades — pass `{ from }` to summarise somebody else's, or a wallet that has never traded reads as a coin with no history.

## State and errors

`Offer.state` is `'open' | 'accepted' | 'cancelled'`. Failures throw `KeiError` with a stable `code`:

| Code | When |
| --- | --- |
| `insufficient-balance` | The wallet does not hold what the offer locks or the accept pays. Names what you hold, what is needed, and how much is locked in your own open offers. |
| `self-swap` | `to` is your own address — only you could accept, and that moves nothing. |
| `self-accept` | Accepting your own listing. `cancel()` is what you want. |
| `offer-taken` | Already accepted. An offer settles exactly once. |
| `offer-cancelled` | The author took it back. |
| `not-the-counterparty` | Reserved for another address (SPEC §9.2). |
| `not-your-offer` | Only the author can cancel — nobody else's asset is locked by it. |
| `no-such-offer` | No offer with that hash on this network. |
| `no-accounts` | `offers()` called without `from`. |
| `bad-expiry` | `expiresIn` and `expiresAt` both passed, or a nonsense timestamp. |

Three properties follow from the design and are worth knowing before you build against it.

**Only the offerer locks anything, and it is their own asset.** The same sword cannot be listed twice, because after the first offer it is not in the seller's spendable balance to offer again. The most confusing symptom is "where did my sword go?" — the answer is usually an offer this wallet already wrote, and `cancel()` frees it.

**Accept and cancel race for one locked entry, and either can win** (SPEC §9.2, conflict 4). Run both and exactly one succeeds; the loser gets a plain `KeiError`. A lost race is a normal outcome, not a bug, and the asset is never stuck — it is with its new owner or back home.

**Expiry is advisory.** The chain has no clock, so an expired offer still settles if somebody accepts it. `Offer.expired` is a hint for the view, never a guarantee. What actually removes a listing is the offerer's own cancel — which the SDK writes in the background by default. Switch that off with `autoCancelExpired: false` and sweep by hand:

```ts
const quiet = await Kei.start({ node, seed: randomSeed(), autoCancelExpired: false })
await quiet.market.cancelExpired()   // Cancellation[], only this wallet's own
```

`cancelExpired()` swallows `offer-taken` and `offer-cancelled` on the way through: losing that race is a sale, not a failure.

## Network boundary

`offers({ from })` and `trades({ from })` read a **bounded walk of the accounts you name**. There is no network-wide listing index (SPEC §9.4): an offer lives on its author's chain, so "every listing on the network" is an indexer, and Kei moves and records assets rather than running a matching engine. Calling `offers()` without `from` throws `no-accounts` on purpose.

Somebody in your app has to remember which accounts have touched an asset. In Carpet Markets that is the registry — it never holds a coin, never quotes a price, and cannot move a balance; it issues, and it is the list of who to read. A reader with the same list gets the same answer without asking it anything.

Everything above runs identically against `Kei.mock()` in-process and against a node over HTTP — clients that share nothing but a URL list, settle, and read price history the same way. The lock is the ledger's, not the SDK's: over the wire, offering seven units when six remain is still refused.

There is no testnet dependency in this quickstart and **nothing in the mock holds value**. A persistent public network is a different deployment decision from the mock — a launchpad anybody can mint on belongs on a chain nobody can mistake for one that matters.

::: tip The current model
This is the peer-to-peer offer book as it exists today: every price is the last thing two people agreed on, read off settled `swap_accept` blocks. There is no pool, no bonding curve, and no automated market maker in `@keicoin/market` — an asset nobody has traded has no price, and `medianPrice()` returns `null` rather than quoting one. For how an offer moves through that model end to end, see [the loop](../carpet-markets.md#the-loop).
:::

## Test it

The market runs end to end against the mock ledger, which enforces the self-locking rule and the accept-vs-cancel race the same way a real node will:

```ts
import { beforeEach, expect, test } from 'bun:test'
import { Kei, randomSeed } from 'kei-transaction'

test('a sale settles atomically, and the price is readable off the chain', async () => {
  const node = await Kei.mock()
  const game = await Kei.server({ seed: 'C'.repeat(64), node })
  await game.faucet(20_000)

  const alice = await Kei.start({ node, seed: randomSeed() })
  const bob = await Kei.start({ node, seed: randomSeed() })
  await Promise.all([game.send(alice.address, 2_000), game.send(bob.address, 2_000)])
  await Promise.all([alice.sync(), bob.sync()])

  const sword = await game.items.create({ name: 'Sword of Testing' })
  await game.items.mint(sword.id, alice.address)
  await alice.sync()

  const offer = await alice.market.sell({ asset: sword, price: 5 })
  expect(await alice.items.owner(sword.id)).toBeNull()   // genuinely locked

  await bob.market.accept(offer)
  expect(await bob.items.owner(sword.id)).toBe(bob.address)
  expect(await bob.balance()).toBe(2_000 - 5)
  expect(await alice.market.medianPrice(sword)).toBe(5)
})
```

Minted assets are a receivable, not a balance — they are owed until the recipient's wallet signs for them, so `sync()` before selling or the listing fails with "balance is 0".

To assert the race directly:

```ts
const results = await Promise.allSettled([bob.market.accept(offer), alice.market.cancel(offer)])
expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
```

## Next steps

- [Offer lifecycle](./offer-lifecycle.md) — one offer end to end: publish, discover, accept or cancel, and reconcile.
- [Future pool design (proposal)](./future-pool-design.md) — an unbuilt proposal for pooled, quoted trading, and the protocol work it would take.
- [Carpet Markets](../carpet-markets.md) — the worked demo this API drives, and what the server is still for.
- [World of Wonder](../world-of-wonder.md) — the same rules inside a real game.
- [Tokens reference](../../reference/tokens.md) — `transfer`, `swap`, and what issuance costs.
