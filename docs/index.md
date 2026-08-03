---
title: Quickstart
description: Install the Kei SDK and send a confirmed payment.
---

# Install to a confirmed payment

Kei has two entry points: one for a player's browser and one for the game's server. A key signs only for its own account, so those roles never collapse into one.

::: info Live on the public testnet
The installable SDK is **0.3.0**, and it defaults to the public testnet at `https://testnet.keicoin.org/rpc`. Since 3 August 2026 that node accepts M4 claim blocks and M5 swaps: a rooted claim lands, a second claim from the same account is refused, an offer locks its units, and one accept moves both legs — measured over the public URL, not inferred from CI.
:::

::: warning It is still one node, and `master` is ahead of npm
The testnet is one rate-limited, best-effort dev node with weak consensus, published dev keys, no uptime promise, and no monetary value. There is no mainnet. Separately, `master` has moved to 0.4.0 and nobody has published it, so item stats and `create-kei-game`'s three templates are merged and not installable. Build against the API, but do not ship a production economy on it.
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

## Continue

- Read the [integration model](./guide/integration.md) before building a purchase flow.
- Treat the [security rules](./guide/security.md) as requirements, not recommendations.
- Use the [wallet](./reference/wallet.md), [token](./reference/tokens.md), and [item](./reference/items.md) references while integrating.
- Read a working game: the [examples](./examples/index.md) are three of them, each one structurally different.
- Check the [current milestone and known gaps](https://keicoin.org/status).
