---
title: Player shop
description: List, browse, buy, cancel, and gift from the player's own key, with no custody by the game.
---

# Player shop

`kei.economy` is the game's half of an economy: recipes the game declares,
stocked from the game's own account. `kei.shop` is the other half, and it
belongs to the player. Every block it writes is signed by one key, and that key
is in the player's browser — so the world the shop is embedded in cannot move
anything in it.

It ships in
[`@keicoin/player-economy`](https://www.npmjs.com/package/@keicoin/player-economy)
at `0.1.2` and installs with `kei-transaction@0.8.0`. Which umbrella releases
actually reach it is recorded once, on
[project status](https://keicoin.org/status), because published and installed
are not the same thing and the gap is where a wrong claim got made here before.
The package is the source of truth for the API — this page is a worked path
through it.

::: warning There is no shop anywhere
A stall is a set of offer blocks on one player's own chain, and a sale is one
accept block that moves both legs or neither. "Every shop in the world" would be
an indexer, which Kei deliberately does not ship. So a world tells this package
which chains to read — a directory — and `browse()` is a floor rather than a
census. A wrong directory can hide a stall. What it cannot do is cost anybody an
item: `buy()` re-reads the offer off the chain and checks it against the listing
that was on screen before signing, and `BuyOptions.verify` defaults to true for
exactly that reason.
:::

## Run a whole stall locally

This playground mints a stackable token and an item to one player, lists a lot
of two, browses it from a second wallet, buys it, and asserts every balance on
both sides. It then refuses the second purchase of a taken lot, refuses a cancel
by somebody who is not the author, cancels properly, gifts the item, and asserts
the game server ends holding none of it. It runs against `Kei.mock()`: no
network request, no key, and nothing in it has value.

From a clone of the site:

```sh
bun install --frozen-lockfile
bun run docs/playgrounds/shop.ts
# {"kind":"shop","lotPrice":240,"unitPrice":120,"buyerPotions":2,"sellerKei":340,"gameKeiUnchanged":true,"coverageComplete":true}
```

The checked-in file below is the file that command executes; the test suite runs
the same file, so the displayed API cannot drift into pseudocode.

<<< ../playgrounds/shop.ts

## Who signs what

| Call | Who signs | What it writes |
| --- | --- | --- |
| `shop.list(request)` | The seller | One offer block, which locks the goods |
| `shop.cancel(listing)` | The seller, and only the seller | One cancel block, which frees them |
| `shop.browse(options)` | Nobody | Nothing — it reads the chains the directory names |
| `shop.buy(listing)` | The buyer | One accept block: both legs or neither |
| `shop.gift(request)` | The giver | One transfer. No price, no offer, no accept |

The game server appears nowhere in that column. It issued the assets and then
held none of the trade — no escrow account, and no cut of the sale unless it
sells something itself.

## A lot price is not a unit price

`list()` takes exactly one of `each` (per unit) or `price` (for the whole lot),
and a `Listing` carries both: `each` is the number a buyer compares, and `price`
is what the lot costs. Two units at `each: 120` is a `price` of 240.

The lock is the ledger's rather than the SDK's. The moment the offer block is
signed, the units leave the seller's balance, so nothing can spend them twice
and a second sale of the same lot is refused at the chain rather than hidden by
a stale screen.

## Three balances, not one

`shop.funds(asset)` returns them separately on purpose, because a block lattice
has three where a bank account has one:

| Field | Meaning |
| --- | --- |
| `confirmed` | On this wallet's chain, spendable this instant. |
| `incoming` | Sent to this wallet and not signed for yet. Real, owed, not spendable. |
| `committed` | Signed a moment ago and not read back. Always a debt, never a credit. |
| `spendable` | `confirmed - committed`, floored at zero. The only number a decision may use. |

Adding the other two into `confirmed` makes the shop offer money that cannot be
spent, and the ledger then refuses with a balance error that reads as a bug in
the shop.

## Browsing says what it could not see

`browse()` returns `shelves` (one per seller), `listings` (flat, cheapest per
unit first — what a buy button iterates), and `coverage`. `coverage.complete` is
true only when every account asked answered in full and nothing was evicted —
which is why it is true in the playground, where the walk names one account and
that account answers. False is the normal case for any market with a roster in
it, and it means "there may be more", never "these rows are wrong". Show it. A
front end that presents a roster as the market is making a claim the chain does
not support.

## A gift carries no note

There is no memo field on any block type in the current wire contract, so
`gift()` has no `memo` option rather than one that always throws. The hash it
returns is exact, which is what a note would have been used to correlate.

## What the playground proves, and what it does not

It proves the custody split and the settlement rules: the ledger lock, the
atomic accept, the author-only cancel, the refusal of a taken lot, and a game
server that ends the run holding none of it. The mock applies the same ledger
rules as the node client.

**It has not been run against the public testnet.** Rooted claims and atomic
swaps have been — the commands behind that measurement are on
[project status](https://keicoin.org/status) — but do not read public-testnet
shop settlement into those results. There is no mainnet, and nothing here has
value.
