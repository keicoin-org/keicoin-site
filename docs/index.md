---
title: Quickstart
description: Install the Kei SDK and send a confirmed payment.
---

# Install to a confirmed payment

Kei has two entry points: one for a player's browser and one for the game's server. A key signs only for its own account, so those roles never collapse into one.

::: warning Current network status
M2 is complete: the published 0.1.0 SDK's exact 10-test M2 suite passes against a clean real-node startup in enforced CI. There is still no public network, mainnet, or asset with value; that work starts in M3. Build against the API, but do not ship a production economy on it.
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

A Kei payment has no memo field until M4. The SDK rejects `pay({ memo })` rather than silently dropping it. There is also no `charge(someoneElse, amount)`: the player signs payment; the issuer signs delivery.

## Continue

- Read the [integration model](./guide/integration.md) before building a purchase flow.
- Treat the [security rules](./guide/security.md) as requirements, not recommendations.
- Use the [wallet](./reference/wallet.md), [token](./reference/tokens.md), and [item](./reference/items.md) references while integrating.
- Check the [current milestone and known gaps](https://keicoin.org/status).
