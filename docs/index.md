---
title: Quickstart
description: Install the Kei SDK and send a confirmed payment.
---

# Install to a confirmed payment

Kei has two entry points: one for a player's browser and one for the game's server. A key signs only for its own account, so those roles never collapse into one.

::: info Live on the public testnet
The installable SDK is **`kei-transaction@0.6.0`**, and it defaults to the public testnet at `https://testnet.keicoin.org/rpc`. Since 3 August 2026 that node accepts rooted-claim and swap blocks: a rooted claim lands, a second claim from the same account is refused, an offer locks its units, and one accept moves both legs — measured over the public URL, not inferred from CI.
:::

::: warning It is still one node
The testnet is one rate-limited, best-effort dev node with weak consensus, published dev keys, no uptime promise, and no monetary value. There is no mainnet. Item stats are published in the current SDK. The `create-kei-game@0.2.0` package on npm is a retired scaffolder and a different product from Create Kei MMO, which is an unpublished draft. Build against the API; do not ship a production economy on it.
:::

## Install

::: code-group

```sh [bun]
bun add kei-transaction
```

```sh [npm]
npm install kei-transaction
```

```sh [pnpm]
pnpm add kei-transaction
```

```sh [yarn]
yarn add kei-transaction
```

:::

The package is ESM, includes TypeScript types, and runs in browsers, Node.js, and Bun.

## Choose the correct entry point

| Context | Start with | Holds |
| --- | --- | --- |
| Player's browser | `Kei.start()` | The player's seed |
| Game server | `Kei.server()` | The issuer's seed |

```ts
import { Kei } from 'kei-transaction'

// Browser: creates and persists a player wallet.
const kei = await Kei.start()
```

```ts
import { Kei } from 'kei-transaction'

// Server only: refuses to run in a browser.
const game = await Kei.server({ seed: process.env.KEI_SEED })
```

::: danger Keep the issuer seed on the server
An issuer seed in client code gives anyone who can view the bundle unlimited minting authority. `Kei.server()` rejects browser environments on purpose.
:::

## Send a payment

The player signs the payment from their own wallet:

```ts
const receipt = await kei.pay({
  to: gameAddress,
  amount: 0.05,
})
```

Persist `receipt.hash` with the order over your normal server channel. This is the player's send-block hash.

The game observes the confirmed payment on its server and delivers from its own account:

```ts
game.onPayment(async ({ from, amount, hash: receiveHash }) => {
  const receive = await game.client.node.blockInfo(receiveHash)
  if (!receive || receive.type !== 'state' || !['open', 'receive'].includes(receive.subtype)) return

  await purchases.recordPayment({ sendHash: receive.link, receiveHash, from, amount })
  await reconcile(receive.link)
})
```

`onPayment.hash` is the game's receive-block hash, not `receipt.hash`; the receive block's `link` is the player's send hash. Persist the order and confirmed payment independently by that send hash, then call the same atomic, idempotent reconciliation path after either write. This handles a payment that confirms before the browser attaches it to the order and prevents duplicate delivery.

A Kei payment has no memo field in the current wire contract. The SDK rejects `pay({ memo })` rather than silently dropping it. There is also no `charge(someoneElse, amount)`: the player signs payment; the issuer signs delivery.

## Economy helpers in the 0.6.0 umbrella

`kei-transaction@0.6.0` is the first umbrella release that depends on both
`@keicoin/economy@0.2.0` and `@keicoin/player-economy@0.1.0`. A plain install now
reaches weighted loot-table drops through `kei.economy` and the player-owned
stall through `kei.shop`; the earlier `0.5.0` umbrella did not reach the shop.

### Weighted loot-table drops

The server and browser import the same declared table:

```ts
import { defineDropTable } from 'kei-transaction'

export const dragonHoard = defineDropTable({
  id: 'dragon-hoard',
  drops: [
    { asset: { symbol: 'GOLD' }, amount: 50, weight: 60 },
    { asset: { symbol: 'SWORD' }, weight: 10 },
  ],
  nothing: 30,
  issuer: GAME_ADDRESS,
})
```

The game publishes one drop batch for the party; each player verifies and then
claims their own award:

```ts
const drop = await game.economy.drop(dragonHoard, party)
send(playerA, drop.awardFor(playerA))

const { symbol, quantity, chance } = await kei.economy.verifyDrop(award)
await kei.claims.add(award)
```

::: warning Not verifiable randomness
The roll happens on the game's server, and nothing here proves the declared
weights were honoured. Verification proves that the published batch was bound
to the table the player saw and that the award is an entry owed to that player;
it does not prove the server rolled fairly.
:::

### Player-owned shop

The player's own key lists, buys, cancels, or gifts. The game never takes
custody of the item or the payment:

```ts
await kei.shop.list({ item: 'sword', qty: 2, each: 120 })
const shelves = await kei.shop.browse()
await kei.shop.buy(shelves.listings[0])
await kei.shop.gift({ to: friend, item: 'sword' })
```

::: warning Current shop evidence
This surface has been exercised against `Kei.mock()` and over HTTP between two
clients sharing only a URL. It has **not yet been run against the public
testnet**. Do not infer public-testnet shop settlement from the rooted-claim and
swap conformance results above.
:::

## Continue

- Read the [integration model](./guide/integration.md) before building a purchase flow.
- Treat the [security rules](./guide/security.md) as requirements, not recommendations.
- Use the [wallet](./reference/wallet.md), [token](./reference/tokens.md), and [item](./reference/items.md) references while integrating.
- Read a working game: the [examples](./examples/index.md) are three of them, each one structurally different.
- Check the [current milestone and known gaps](https://keicoin.org/status).
