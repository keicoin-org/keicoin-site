---
title: Carpet Markets
description: A coin launchpad with a real peer-to-peer order book, and the worked demo of the Kei market API.
---

# Carpet Markets

A coin launchpad in the pump.fun shape: anybody launches a coin in one click, whoever launched it is holding all of it, and from there it is worth whatever the next person will pay.

**This is the worked demo of the market API.** There is no bonding curve and no house. Every trade is an offer one player wrote and another accepted — `swap_offer` and `swap_accept`, settled in one block by consensus. [Play it](https://keicoin.org/examples/carpet-markets), or read [the source](https://github.com/keicoin-org/carpet-markets).

::: danger Read this before you copy anything here
Two separate things are true, and the second one is usually left out.

**The argument holds.** Every claim the interface makes about a coin is asserted at the ledger by a test, not in the client. `lib/market.ts` is a faithful reading of `@keicoin/market` and is the file to steal.

**The interface around it does not.** Assessed against the pump-style launchpads it is modelled on, this front end is **materially weaker**, and its UX does not carry a first-time visitor through a trade. Seven of its [nine written criteria](https://keicoin.org/status) are unmet. It also runs an **in-memory mock chain that resets**, and it is **not production-ready and cannot become mainnet-ready** — mainnet is not a build task, and a launchpad is the worst possible first thing to put on a real network. Take the calls; leave the screen.
:::

| | |
| --- | --- |
| Client | Next.js 16, React 19, Tailwind 4 — shipped as a **static export**, no Node server behind it |
| Server | One Bun process — the mock node, the registry, and the dev proxy's target |
| Database | None. No `users`, no `balances`, no `holdings` |
| Chain | In-memory mock; a Durable Object in the hosted copy |
| Every line of Kei in the client | `lib/market.ts` |

## Run it

```sh
git clone https://github.com/keicoin-org/carpet-markets
bun install
bun run dev          # client on :3000, chain and registry on :7788
```

`next dev` proxies `/rpc` and `/market/*` to the Bun process. The deployed copy has no proxy: `bun run build:site` writes a static export to `dist/examples/carpet-markets/`, and a Cloudflare Worker serves those files and answers the same two paths out of a Durable Object. That is the only difference between running it and shipping it.

## The loop

| | |
| --- | --- |
| **Launch** | Name a coin, pick who may move it, pay the fee. You are minted the whole supply. |
| **Sell** | Write an offer: how many, and what you want for them. The coins lock until it settles or you cancel. |
| **Buy** | Accept somebody's offer. One block, both legs, or neither. |
| **Cancel** | Take back your own unaccepted offer, and the coins with it. |

![Protocol diagram of the bilateral offer lifecycle: publish locks the give asset, an address-scoped UI discovers the offer and re-reads it by hash to check it is still open, then either an accept settles both legs atomically or a seller cancel releases the lock, with both paths reconciling from mine() and trades().](/img/docs/carpet-offer-lifecycle.svg)

*A protocol diagram, not a screenshot. Current bilateral offers only — no pool, no bonding curve — and the chain is authoritative.*

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

[Market API](./carpet-markets/api.md) is the quickstart for these calls: exact signatures, the errors they throw, and what "no indexer" means when you go to read a book.

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
shared/social.ts      the replies, and what a signature on one does and does not prove.
server/registry.ts    issues coins, and remembers who to read. The whole backend.
server/main.ts        one Bun server: the mock node at /rpc, the registry at /market/*
app/                  the routes: the floor, and a page per coin.
components/           the cards, the badge, the holders panel, the reply thread.
lib/market.ts         every line of Kei in the client.
worker/index.ts       the deployed copy: static export out of ASSETS, chain in a Durable Object.
```

Read `lib/market.ts` to learn the market API. Read `server/registry.ts` to learn what a server still has to do when it is not allowed to touch the money.

## The card is an argument, not a dashboard

The genre this copies puts the market cap in the largest type on a card and the transfer policy in grey text below the fold. This inverts that: the policy badge is the loudest thing on a card and it reads **CAN BE DUMPED**, and the feature slot is *most traded* rather than a market cap — because a market cap here would be a supply nobody has bought, multiplied by a price one person paid once.

Beside it is the number that actually predicts a rug: how much of the supply the creator is still holding. It starts at 100% and only falls when they sell.

Two panels are new and both are honest about what they are. **Holders** is read with `balanceOf`, and its percentages are of the supply rather than of the rows, because the registry can only ask about accounts it has heard of. **Replies** are the only state in this project that is not a block: the registry stores them and loses them with the chain. They carry a signature from the same key that signs their author's blocks, so nobody can post as the creator — a strictly weaker claim than a block makes, and the panel says so rather than letting the word *signed* imply consensus.

Coin art is derived from the asset id rather than uploaded — a small mirrored kilim, since the site is called Carpet Markets — so there is no pinning service, no bucket, and no moderation problem, and the same coin draws the same rug everywhere.

## Four things worth stealing

Each one cost an afternoon.

::: warning `sell({ amount, price })` takes the total ask, not the price each
The `Offer` that comes back reports `price` *per unit*, so the two differ by `amount`. Getting it backwards mislists by several orders of magnitude on a coin with a million units. `lib/market.ts` multiplies in one place for exactly this reason.
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

`test/social.test.ts` covers the other claim the interface makes — that the address on a reply wrote it. Every test in it is a way of trying to post as somebody else: forging the author, editing the body after signing, lifting a signed reply onto another coin, and sending the same one twice.

## Known limits

::: danger This is a satire of a pattern that has taken real money from real people
It is worth playing precisely because the coins are worthless. It is not worth copying anywhere they are not.
:::

- **The book is only as complete as the account list.** The registry lists offers from accounts it has heard of. An offer written by a wallet that never announced itself is perfectly valid, settles perfectly well, and does not appear here — which is what "there is no indexer" means in practice.
- **One open quote per address.** A Kei transfer carries no memo, so an arriving payment says only who sent it and how much. Two browser tabs racing is a thing you can do to yourself. The honest fix is a memo field in the wire format, not a cleverer guess on this side.
- **The registry keeps unmatched payments.** Send it Kei answering no quote and it stays there. Reflexively refunding whoever sends money would make it return its own working capital to the faucet on startup.
- **A creator selling their whole position is not an exploit.** It is the documented behaviour of `transfer: 'open'`. If you would like it to be impossible, that is the other radio button, and it is impossible at the ledger rather than in the app.
- **The replies are not on the chain**, and they are the only thing here that is not. They go when the chain does.
- The hosted copy runs an in-memory mock chain inside a Durable Object, so the ledger resets when that object is evicted. It does **not** run against the public testnet, even though the testnet has settled swaps since 3 August 2026 — this demo is a launchpad anybody can mint on, and that belongs on a chain nobody can mistake for one that matters.

## What is still wrong with it, in order

The argument is proven and the screen is not, so the gap is written down as
criteria rather than left to taste. These are the nine it is closed against, and
they are the same list carried on the [status page](https://keicoin.org/status).

| | Criterion | Today |
| --- | --- | --- |
| 1 | A first-time visitor with no wallet completes one buy in five interactions or fewer | Not met |
| 2 | Every state that can refuse a trade — an unsynced receivable, units locked in an open offer, spendable below the ask — is named on screen *before* the action, not surfaced as a failure after it | Not met |
| 3 | A trade's result appears without a manual refresh, and pending stays visually distinct from confirmed | **Met** — `lib/balance.ts` carries all three numbers to the screen |
| 4 | Price, volume and holder panels say "no trades yet" rather than showing a zero | **Met** for price; not elsewhere |
| 5 | No horizontal scroll at a 360 px viewport, primary action reachable | Not met |
| 6 | Launch → sell → buy → cancel completable by keyboard alone | Not met |
| 7 | The transfer-policy badge is the loudest element on a card and links to the ledger fact behind it | Partly — it is the loudest; it does not link |
| 8 | Every claim the interface makes is asserted at the ledger by a test | **Met**, for the claims that exist |
| 9 | Each known hole — the account-bounded book, one open quote per address, off-chain replies — is stated on the screen where it bites, not only here | Not met |

### And "mainnet-ready" is not on that list

It is not an omission. **Mainnet is not a build task**: it is gated by validator
distribution, reserve governance, and a legal conversation, and nothing shipped
in this repository moves any of them. A launchpad is also the one demo whose
entire subject is people losing money, which makes it the worst possible first
thing to put on a real network — and exactly why it is defensible here, where the
coins are worth nothing by construction. Reading a roadmap into this page is
reading something that is not written on it.

## Continue

- [Market API](./carpet-markets/api.md) — the `@keicoin/market` quickstart, signature by signature.
- [Offer lifecycle](./carpet-markets/offer-lifecycle.md) — one offer from publish to settlement or cancellation, and how to rebuild the view from the chain.
- [Future pool design (proposal)](./carpet-markets/future-pool-design.md) — a **proposal**, not shipped behaviour: what a pump-style pooled buy/sell box would cost, and why `@keicoin/market` cannot do it today.
- [World of Wonder](./world-of-wonder.md) — the same rules inside a real game.
- [Tokens reference](../reference/tokens.md) — `transfer`, `swap`, and what issuance costs.
- [Project status](https://keicoin.org/status) — the market is published, and the public testnet settles swaps as of 3 August 2026.
