---
title: Integration model
description: Separate player, issuer, ledger, game-state, indexing, and recovery authority in a Kei integration.
---

# Integration model

## Outcome

Build a purchase path where the player and issuer remain separate signers,
orders and confirmed payments may arrive in either order, and one send hash can
fulfill at most once. The executable proof runs both orderings through the same
reconciliation function.

## Run the integration proof

```sh
bun install --frozen-lockfile
bun run docs/playgrounds/payment-reconciliation.ts
# {"kind":"payment-reconciliation","scenarios":[{"ordering":"order-first","linkMatches":true,"deliveries":1},{"ordering":"payment-first","linkMatches":true,"deliveries":1}],"memoRefusal":"no-memo-yet"}
```

<<< ../playgrounds/payment-reconciliation.ts

## Authority and trust boundary

| Concern | Authority and limit |
| --- | --- |
| Player key | The player's wallet. The game may request a signature, never copy or use the key. |
| Issuer key | Server-side secret storage used only by `Kei.server()`. It cannot debit a player. |
| Balances and ownership | Accepted account-chain state. Application tables may cache, not replace it. |
| Realtime game state | The game server or simulation authority: position, combat, presence, cooldowns, matchmaking. |
| Market discovery/indexing | An application directory names bounded account chains to read. It cannot move assets or make a listing authoritative. |
| Purchase meaning | The application's order table, joined to confirmed chain state by send hash. |
| Recovery | Player-controlled seed backup or an explicitly chosen custody design. Kei has no automatic account-recovery service. |

## Player: browser

```ts
import { Kei } from 'kei-transaction'

const kei = await Kei.start()
const payment = await kei.pay({ to: gameAddress, amount: 0.05 })
await attachPayment(order.id, payment.hash)
```

The player's seed stays with the player. A game asks the wallet to make a
payment; it does not debit the player itself.

## Issuer: server

```ts
import { Kei } from 'kei-transaction'

const game = await Kei.server({ seed: process.env.KEI_SEED! })

const gems = await game.token.issue({
  name: 'Gems',
  symbol: 'GEM',
  decimals: 0,
  transfer: 'open',
})
```

The issuer can issue and deliver assets. It cannot authorize a payment from a
player's account. Follow the [security rules](./security.md#authority-and-trust-boundary)
before placing either signer in a process.

## Purchase state transitions

1. The player signs and publishes a payment.
2. The browser persists the returned send-block hash with the order over the
   game's normal authenticated channel.
3. The game observes a confirmed receive block. It resolves
   `onPayment.hash`, then reads that block's `link` as the player's send hash.
4. Order arrival and payment arrival each invoke the same reconciliation path.
5. That path verifies recipient, sender, amount, and purchase context.
6. One database transaction inserts a unique fulfillment keyed by send hash and
   records the delivery request.
7. The issuer signs delivery; the player later observes the asset in their own
   account.

A payment can arrive before its order. An order can arrive before receiver
processing. Neither is an error and neither justifies a one-shot event handler.
A payment has no memo field in the current wire format; `no-memo-yet` forces the
exact send hash to remain the identifier.

## What remains off-chain

Kei replaces the ledger, not the game server. Keep position, presence, combat,
matchmaking, cooldowns, and other fast-changing instance state in the system
that owns the real-time loop. Keep account directories and catalogue search in
bounded application indexes. Neither kind of application state may invent a
balance or sign for a player.

## Failure cases

- A mismatched sender, recipient, amount, or order context is a refusal, not a
  best-effort fulfillment.
- A repeated callback or worker replay must encounter the existing unique
  fulfillment record.
- A lost reply after a signed write requires chain reconciliation before any
  resubmission.
- Lost player keys are not repaired by an issuer database. Make custody and
  backup status visible before the wallet holds anything.
- A global market or item browse view needs an explicit bounded index; do not
  imply that one account-chain read discovers the network.

Use the stable [error recovery categories](../reference/errors.md#recovery-categories)
for control flow, and check
[where each code comes from](../reference/errors.md#where-the-code-comes-from-decides-whether-it-is-stable)
before branching on one: a refusal raised by the node arrives as `node-error`,
not as the granular code `Kei.mock()` returns for the same attempt.

## What `Kei.mock()` proves

The proof runs the released player and issuer clients, creates real mock-chain
send and receive blocks, resolves their hash link, exercises both application
event orderings, refuses a memo, and proves exactly-once behavior in its sample
store. It does not prove public-network consensus, database durability, wallet
recovery, application authentication, or production readiness.

For the parts that only a real node can settle — a rooted claim, an atomic swap,
and the refusal codes the node actually sends — run the
[public testnet proof](../reference/testnet.md).
