---
title: Integration model
description: Understand the player and issuer halves of a Kei integration.
---

# Integration model

A Kei integration always has two signers. The player's browser controls the player's account. The game server controls the issuer account. Neither can sign for the other.

## Player: browser

```ts
import { Kei } from 'kei-transaction'

const kei = await Kei.start()

await kei.pay({
  to: gameAddress,
  amount: 0.05,
  memo: 'Sword of Testing',
})

const gems = await kei.token('GEM', gameAddress)
const balance = await gems.balance()
```

The player's seed stays with the player. A game asks the wallet to make a payment; it does not debit the player itself.

## Issuer: server

```ts
import { Kei } from 'kei-transaction'

const game = await Kei.server({ seed: process.env.KEI_SEED })

const gems = await game.token.issue({
  name: 'Gems',
  symbol: 'GEM',
  decimals: 0,
  transfer: 'open',
})

game.onPayment(async ({ from, amount }) => {
  if (amount >= 0.05) await gems.mint(from, 100)
})
```

The issuer can issue assets and deliver them. It cannot authorize a payment from a player's account.

## Purchase sequence

1. The player signs and publishes a payment.
2. The game observes the confirmed payment.
3. The game validates the amount, recipient, and purchase context.
4. The issuer signs delivery of currency or an item.
5. The player observes the delivered asset in their wallet.

Each side can retry its own operation. Design the server handler to be idempotent so the same confirmed payment cannot deliver twice.

## What remains off-chain

Kei replaces the ledger, not the game server. Keep real-time position, presence, combat rules, matchmaking, and per-instance mutable state in the systems already responsible for them.

Use the chain for facts that benefit from durable ownership and settlement:

- balances;
- ownership;
- transfers;
- mint and burn history;
- committed reward claims;
- payment settlement.
