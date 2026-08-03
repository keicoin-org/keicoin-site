---
title: Carpet Markets
description: A coin launchpad with a real peer-to-peer order book, and the worked demo of the Kei market API.
---

# Carpet Markets

A coin launchpad in the pump.fun shape: anybody launches a coin in one click, whoever launched it is holding all of it, and from there it is worth whatever the next person will pay.

**This is the worked demo of the market API.** There is no bonding curve and no house. Every trade is an offer one player wrote and another accepted — `swap_offer` and `swap_accept`, settled in one block by consensus. [Play it](https://keicoin.org/examples/carpet-markets), or read [the source](https://github.com/keicoin-org/carpet-markets).

| | |
| --- | --- |
| Client | Plain DOM, one bundle |
| Server | One Bun process — the mock node, the registry, and the static client |
| Database | None. No `users`, no `balances`, no `holdings` |
| Chain | In-memory mock; a Durable Object in the hosted copy |
| Every line of Kei in the client | `src/market-client.ts` |

## Run it

```sh
git clone https://github.com/keicoin-org/carpet-markets
cd carpet-markets
bun install
bun run dev          # http://localhost:7788
```

## The loop

| | |
| --- | --- |
| **Launch** | Name a coin, pick who may move it, pay the fee. You are minted the whole supply. |
| **Sell** | Write an offer: how many, and what you want for them. The coins lock until it settles or you cancel. |
| **Buy** | Accept somebody's offer. One block, both legs, or neither. |
| **Cancel** | Take back your own unaccepted offer, and the coins with it. |

## The transfer policy is the whole argument

There is no mechanic here called *rug*. A creator holding the supply can sell it, in whatever size they like, whenever they like — that is not a special power, it is selling, and it is the only thing anybody on this market can do.

What the chain decides is whether that market can exist at all, and it decides it once, at issuance:

| Issued as | What it means |
| --- | --- |
| `transfer: 'open'` | Anybody can send it to anybody, so there is a real order book — and the creator is holding a million of them. |
| `transfer: 'issuer-only'` | Units move only to or from the issuing account. An offer between two holders is an invalid block, so no player-to-player market exists or can. |
| `transfer: 'none'` | Soulbound. It cannot be locked into an offer, so it cannot be sold, by anybody, including whoever made it. |

A database can hold the same flag, and a developer can edit the row. That is the entire difference: a player can read the badge, buy the open coin anyway, watch the creator work through their position a thousand at a time, and check afterwards that the chain said so the whole time.

The site never claims a coin is safe. It shows you what was issued.

## The market API, as this demo uses it

```ts
// Player — src/market-client.ts
await kei.sync()
const offer = await kei.market.sell({ asset, amount, price: amount * unitPrice })
await kei.market.accept(offer)
await kei.market.cancel(offer)
const open = await kei.market.mine({ state: 'open' })
```

```ts
// Registry — server/registry.ts. Reads, never writes anybody's position.
const [asks, bids, trades, price] = await Promise.all([
  kei.market.offers({ from, asset, state: 'open' }),
  kei.market.offers({ from, want: asset, state: 'open' }),
  kei.market.trades({ from, asset }),
  kei.market.price(asset, { from }).catch(() => null),
])
```

An offer locks the coins out of the seller's wallet until it settles or is cancelled. Nobody can move them in the meantime, including whoever issued them.

## There is no curve, deliberately

An earlier version priced everything with a linear bonding curve: the server minted on every buy, burned on every sell, and paid people out of a reserve it held. That made the server the counterparty to every trade — the payment infrastructure Kei exists to remove — and it meant the "price" was a formula, not a price.

Now the price is the last thing two people agreed on, and `market.price()` reads it off the settled `swap_accept` blocks. **A coin nobody has traded has no price, and the page says so instead of quoting one.** That is what a chain can honestly tell you and an AMM cannot.

Removing the curve also removed *graduation*, a threshold at which the curve closed and the coin "left". It was borrowed from the thing this repo is making fun of, and it put a clock on the only decision that mattered.

## The launch fee is flat, and that is the fix

Issuing an asset burns Kei, and the nth asset an **account** issues burns n Kei. The rule is per account, and its purpose is that one account cannot cheaply create a great many permanent asset records.

This repo used to issue every coin from the registry's own account, which turned that per-account rule into a tax on arriving late: the fiftieth visitor paid for the forty-nine launches before theirs, a newcomer's *first* coin was the most expensive thing on the site, and the whole place stopped working somewhere around the thousandth coin. The code called that the anti-spam mechanism. It was the bug.

Every coin now gets its own issuing account, derived from the registry's seed by index:

```ts
// server/registry.ts
const issuer = await Kei.server({ seed, index })
await kei.send(issuer.address, /* the burn, plus a margin */)
const token = await issuer.token.issue({ name, symbol, decimals, transfer, maxSupply })
```

A launch pays that account's first burn — **1 Kei, forever** — and never anybody else's. Spam is still bounded, per launcher, exactly as intended.

## What the server is, and is not

It is not a market. It never holds a coin, never quotes a price, and cannot move anybody's balance. It does two things, and both are things a chain deliberately does not do:

1. **It issues.** A coin needs an issuing account, and issuance burns Kei.
2. **It is the list of who to read.** `market.offers()` requires a `from`, because an offer lives on its author's chain. "Every offer on the network" is an indexer, and Kei does not ship one. Somebody has to remember which accounts have touched a coin.

Everything it reports is read back off the chain. A reader with the same list of accounts gets the same answer without asking this server anything — which is the property worth having, and the reason it is an index rather than an oracle.

## Where things are

```
shared/format.ts      turning numbers into text. Used to be the bonding curve.
shared/listing.ts     the wire shape, and what a valid coin identity is.
server/registry.ts    issues coins, and remembers who to read. The whole backend.
server/main.ts        one Bun server: the mock node at /rpc, the registry at /market/*, the client at /
src/market-client.ts  every line of Kei in the client.
src/main.ts           the market floor.
src/ui.ts             elements and the chart.
```

Read `src/market-client.ts` to learn the market API. Read `server/registry.ts` to learn what a server still has to do when it is not allowed to touch the money.

## Four things worth stealing

Each one cost an afternoon.

::: warning `sell({ amount, price })` takes the total ask, not the price each
The `Offer` that comes back reports `price` *per unit*, so the two differ by `amount`. Getting it backwards mislists by several orders of magnitude on a coin with a million units. `src/market-client.ts` multiplies in one place for exactly this reason.
:::

- **`market.price()` defaults to your own trades.** Pass `{ from }`, or a wallet that has never traded summarises nothing and returns `null` — which reads like the coin has no history.
- **A payment event carries a JS number.** `PaymentEvent.amount` is a double, and a double cannot hold eighteen decimal places: a fee of exactly 1.1 Kei arrives as `1.0999999999999999`. An equality check against a quote therefore rejects real payments. Accept a documented dust tolerance and refund the change.
- **Minted coins are a receivable, not a balance.** They are owed until the recipient's wallet signs for them. Selling before `sync()` fails with "balance is 0", which is correct and reads like a bug in the market.

## Configuration

| Variable | Default | Effect |
| --- | --- | --- |
| `PORT` | `7788` | Listen port |
| `CARPET_SEED` | generated per run | The registry seed. Every coin's issuing account is derived from it by index. |

## Tests

```sh
bun run check     # typecheck, worker typecheck, and the tests
```

`test/registry.test.ts` is where the claim on the badge is either true or marketing. It asserts at the ledger that a soulbound coin cannot be offered at all, that an issuer-only coin cannot be traded between two holders, that an open one settles peer-to-peer in whatever size the seller chose, and that the launch fee does not move as coins pile up.

## Known limits

::: danger This is a satire of a pattern that has taken real money from real people
It is worth playing precisely because the coins are worthless. It is not worth copying anywhere they are not.
:::

- **The book is only as complete as the account list.** The registry lists offers from accounts it has heard of. An offer written by a wallet that never announced itself is perfectly valid, settles perfectly well, and does not appear here — which is what "there is no indexer" means in practice.
- **One open quote per address.** A Kei transfer carries no memo, so an arriving payment says only who sent it and how much. Two browser tabs racing is a thing you can do to yourself. The honest fix is a memo field in the wire format, not a cleverer guess on this side.
- **The registry keeps unmatched payments.** Send it Kei answering no quote and it stays there. Reflexively refunding whoever sends money would make it return its own working capital to the faucet on startup.
- **A creator selling their whole position is not an exploit.** It is the documented behaviour of `transfer: 'open'`. If you would like it to be impossible, that is the other radio button, and it is impossible at the ledger rather than in the app.
- The hosted copy runs an in-memory mock chain inside a Durable Object, so the ledger resets when that object is evicted.

## Continue

- [World of Wonder](./world-of-wonder.md) — the same rules inside a real game.
- [Tokens reference](../reference/tokens.md) — `transfer`, `swap`, and what issuance costs.
- [Project status](https://keicoin.org/status) — the market is merged and published; no public node deployment carrying the native swap blocks is claimed.
