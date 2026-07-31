---
title: Quickstart
description: Install the Kei SDK and send a confirmed payment.
---

# Install to a confirmed payment

Kei has two entry points: one for a player's browser and one for the game's server. A key signs only for its own account, so those roles never collapse into one.

::: warning Current network status
The SDK runs end to end against an in-memory mock. There is no public network, mainnet, or asset with value yet. Build against the API; do not ship a production economy on it.
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
  memo: 'Sword of Testing',
})
```

The game observes the confirmed payment on its server and delivers from its own account:

```ts
game.onPayment(async ({ from, amount }) => {
  if (amount >= 0.05) await gems.mint(from, 100)
})
```

There is no `charge(someoneElse, amount)`. The player signs payment; the issuer signs delivery.

## Continue

- Read the [integration model](./guide/integration.md) before building a purchase flow.
- Treat the [security rules](./guide/security.md) as requirements, not recommendations.
- Use the [wallet](./reference/wallet.md), [token](./reference/tokens.md), and [item](./reference/items.md) references while integrating.
- Check the [current milestone and known gaps](https://keicoin.org/status).
