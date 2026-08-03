---
title: Auction house integration
description: Wire World of Wonder's player-to-player auction house into your own fork, where a listing is a block on the seller's chain and your server is only an address book.
---

# Auction house integration

**By the end of this page your fork has a player-to-player auction house whose listings live on sellers' own chains, whose sales settle both legs at once or not at all, and whose server holds nobody's item and signs nothing.**

This is the narrow version of [World of Wonder](../world-of-wonder.md)'s Auction House panel: the calls the player's wallet makes, the two routes the server answers, and the check that has to be there before an accept is signed. Every line below is in the repository — the wallet side is `src/client/Controllers/Wallet.ts`.

## Before you begin

| | |
| --- | --- |
| A running fork | `git clone https://github.com/keicoin-org/world-of-wonder`, then the [run steps](../world-of-wonder.md#run-it) |
| Node | 20.17 or later |
| SDK | The released `kei-transaction` package, which is a plain npm dependency — no sibling checkout, no link step |
| A currency | An asset your server issues and players can transfer between themselves. Gold, here. |
| The asset ids | The client's catalogue supplies the coin asset and one asset per item archetype. Nothing below hardcodes an id. |
| Which chain | `KEI_NETWORK=mock` is right while you are reading. The default is the public testnet. |

You do **not** need a listings table, a matching engine, or a job that expires offers. If you are about to write one, this page is the argument against it.

## What you are building, in four moves

| Move | Who signs it | Call |
| --- | --- | --- |
| List an item | The seller's wallet | `market.offer({ give, want })` |
| Show the board | Nobody — it is a read | `market.offers()` / `market.trades()` over a roster of addresses, behind `GET /kei/hall` |
| Buy a listing | The buyer's wallet | `market.get(hash)` → verify → `market.accept(live)` |
| Take a listing back | The seller's wallet, and only the seller's | `market.cancel(hash)` |

The verified SDK surface is `market.offer`, `market.get`, `market.accept`, `market.cancel`, `market.offers`, `market.mine`, `market.trades`, and `market.price`. There is no server-side call in that list, and that is the design rather than an omission.

## The integration, in one file

This is the whole player side, from `src/client/Controllers/Wallet.ts`, using only the methods above.

```ts
// item.asset and this._coin both come from the client's catalogue.
// this._kei is the player's wallet; the game server never holds this key.

async list(item: { asset: string }, qty: number, price: number) {
  const offer = await this._kei.market.offer({
    give: { asset: item.asset, amount: qty },   // the item, locked on the seller's own chain
    want: { asset: this._coin, amount: price }, // gold — the asset this world issues
  })
  await this.announce()  // tell the hall there is a chain here worth reading
  await this.refresh()   // the item has left the bag: locked, not gone
  return offer           // offer.hash is the listing id
}

async accept(listing: DisplayedOffer) {
  // The hall is an index, not an authority. Read the offer back off the chain.
  const live = await this._kei.market.get(listing.hash)
  if (!live || live.state !== 'open') {
    throw new Error(`${listing.title} is gone — somebody else bought it, or the seller took it back.`)
  }

  // Bind seller, item asset, quantity, quote asset and price to what was displayed.
  const item = this._shop.get(listing.key)
  if (!item || !offerMatchesDisplay(live, listing, item.asset, this._coin)) {
    throw new Error(
      'That listing does not match the seller, item, quantity, and price that were shown to you. Refresh the hall and look again.',
    )
  }

  await this._kei.market.accept(live)  // both legs, one settlement
  await this.announce()
  await this.refresh()
}

async cancel(listing: { hash: string; seller: string }) {
  if (listing.seller !== this.address) {
    throw new Error('Only the seller can take a listing back.')
  }
  await this._kei.market.cancel(listing.hash)
  await this.refresh()  // the item is back in the bag
}

// Your own listings need no server at all — they are on the chain you hold the key to.
myListings() {
  return this._kei.market.mine({ state: 'open' })
}
```

::: warning It is `market.offer()`, not `market.sell()`
`sell()` prices things in Kei. Gold is not Kei — it is an asset this world issues — so a listing is an item on one side and gold on the other. Writing it the other way compiles and quietly denominates your auction house in a currency your game does not use.
:::

## The flow

Two browsers and a server that is party to neither trade. Time runs down the page. This is a diagram, not a screenshot.

```
  SELLER (browser)              GAME SERVER                    BUYER (browser)
  ────────────────              ───────────                    ───────────────
  market.offer({give,want})
    │  Offer published on the seller's own chain.
    │  Only the give asset — the item — is locked. Nobody else's asset moves.
    │  The offer id is its hash.
    │
  POST /kei/hall/watch ───────► adds a public address to the read roster.
   ?address=...                 Grants no authority over anything.
                                     │
                                GET /kei/hall ◄─────────────── the panel asks for the board
                                  reads offers from the
                                  watched account chains
                                     └── listings + price history ──►
                                                                     │
                                              market.get(listing.hash)
                                                │  read the offer back off the chain
                                                │  require live.state === 'open'
                                              offerMatchesDisplay(live, shown, …)
                                                │  seller, item asset, qty, quote asset, price
                                              market.accept(live)
                                                │
    ◄──────────── one atomic settlement ────────┘
       gold → seller and item → buyer together, or neither leg moves.
       The server learns about it by being told to look again.
```

The server appears twice, and both times it is answering *where to look*. It never sees the settlement, because it is not party to one.

## Finding listings: the server is an address book

An offer lives on its author's chain and **Kei ships no network-wide indexer**, so there is no query for *every listing in the world*. Something has to remember which accounts are worth asking. That is the entire job of the hall, and it is bookkeeping about where to look rather than about who owns what.

- `GET /kei/hall` reads offers from the accounts on the watched roster and returns them.
- `POST /kei/hall/watch?address=...` adds one public address to that roster. It grants no authority, moves nothing, and signs nothing — an account with no offers contributes an empty read, and an account with offers had them whether or not anybody was looking. Validate the address shape and bound the roster; that is the whole of its security surface.

There is deliberately no `POST /kei/list`. A listing is a block on the seller's chain, so it is not something a server *can* write for them.

## Binding the offer, and what a hostile hall can do

The hall is an index. The ledger signs its own numbers, not your panel's — so re-read by hash and refuse anything that does not match what the buyer was looking at. Matching price and quantity alone is **not** enough: a dishonest hall could attach the hash of a different offer at the same numbers. Binding the **seller and the item asset** is what closes that.

| | Can a hostile hall do it? |
| --- | --- |
| Hide a listing from a buyer | Yes. Costs visibility, never an asset — the offer is on the chain either way. |
| Show a listing that no longer exists | Yes, and the accept fails at the ledger rather than costing anybody gold. |
| Substitute a different item at the same price | No, once the item asset is bound. Without that check, yes. |
| Relabel who is selling | No, for the same reason. |
| Hold, move, or take a listed item | No. It signs nothing, and the lock is on the seller's chain. |
| Invent a settlement | No. A trade is signed by the buyer. |

The rules underneath, in order of how expensive they are to get wrong:

- **Never broker the trade.** Your server issues this world's currency, so it can mint gold at will — but it cannot sign for or move a player's item, which is locked on the seller's own chain. Keep it out of custody and out of the accept path, and leave the settlement to be signed on-chain by the seller who published the offer and the buyer who accepts it.
- **Re-read by hash and bind every leg** before signing an accept: seller, item asset, quantity, quote asset, price.
- **Take names from your own catalogue**, not from the hall, and drop any listing whose key you do not recognise.
- **Only the seller cancels.** Refuse it in the UI too, so a player gets a sentence rather than a ledger rejection.

## State and errors

| State | What it means | What the player sees |
| --- | --- | --- |
| Offer published | The give asset is locked on the seller's chain; the item is out of the bag | The listing appears under Mine |
| `live.state !== 'open'` | Bought or cancelled between render and click | "It is gone — somebody else bought it, or the seller took it back." |
| Display mismatch | The hall showed something the chain does not agree with | A refusal naming seller, item, quantity and price, and a prompt to refresh |
| Accept succeeds | Both legs settled together — gold to the seller, item to the buyer | Bag and purse refresh; nothing partial is possible |
| Cancelled | The lock is released and the item returns | The item is back in the bag |
| Expired | **Advisory only.** The ledger does not enforce expiry — an expired offer still settles if somebody accepts it | Treat it as a hint; a cancel is the only thing that frees the lock |

An accept that loses a race is the normal case, not an exception path: the board is polled, the chain is authoritative, and the gap between the two is where every real error lives.

## Run it, and check it

The market has its own test, in-process:

```sh
npm run test:market
```

Then the same thing across a URL, which is the one worth trusting:

```sh
npm run server-build && npm run server-start &
npm run test:e2e         # KEI_TEST_BASE, default http://localhost:3000
```

`test:e2e` signs its own transactions over HTTP and shares no memory with the server, so passing it means a hosted client can work rather than suggesting it might.

To see the panel a player sees:

```sh
npm run client-dev       # http://localhost:8080 — the Auction House panel
```

## What this deliberately does not do

- **There is no global board.** The hall shows the offers of accounts it has been told about. An unheard-of seller is invisible — without ever losing custody of the listed item.
- **There is no matching engine.** Nothing pairs bids with asks; a buyer accepts a specific offer by hash.
- **There is no expiry sweeper on the ledger.** Expiry is advisory; cancel is the action with teeth.

## Next steps

- [World of Wonder](../world-of-wonder.md) — the whole fork this panel sits in, and what else changed from upstream.
- [Carpet Markets](../carpet-markets.md) — the same address-book problem solved with a registry.
- [Security rules](../../guide/security.md) — why no endpoint here can move a player's money.
- [Items reference](../../reference/items.md) — the asset side of what is being listed.
