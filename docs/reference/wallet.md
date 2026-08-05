---
title: Wallet
description: Own a player account, reconcile payments by block hash, and handle wallet state honestly.
---

# Wallet

## Outcome

`Kei.start()` returns the player-side client. The runnable proof below makes one
purchase arrive in each possible order, correlates the receiver's block back to
the player's send hash, and delivers exactly once through one reconciliation
function. It also proves that a payment memo is refused rather than discarded.

## Run the payment proof

From a clean clone of this site:

```sh
bun install --frozen-lockfile
bun run docs/playgrounds/payment-reconciliation.ts
# {"kind":"payment-reconciliation","scenarios":[{"ordering":"order-first","linkMatches":true,"deliveries":1},{"ordering":"payment-first","linkMatches":true,"deliveries":1}],"memoRefusal":"no-memo-yet"}
```

The file below is the file the command and site regression test execute.

<<< ../playgrounds/payment-reconciliation.ts

## Authority and trust boundary

| Fact | Authority |
| --- | --- |
| Player key and signed send | The player's wallet. The game cannot sign it. |
| Confirmed payment | The receiver's account chain, read back from the node. |
| Purchase meaning | The game's durable order record, keyed by the payment send hash. |
| Fulfillment | One atomic game-database transaction with a unique send-hash record. |
| Live UI state | A presentation of those facts, never a settlement authority. |

`pay()` returns the player's **send-block hash**. `onPayment.hash` is the
receiver's **receive-block hash**. Resolve that receive block with
`game.client.node.blockInfo()`; its `link` is the send hash that identifies the
purchase.

## Payment state transitions

1. Record an order by send hash, even if no payment is recorded yet.
2. Record a confirmed payment by resolving receive hash to send hash, even if no
   order is recorded yet.
3. Invoke the same reconciliation function after either insert.
4. Deliver only when both records agree on sender and amount.
5. Insert fulfillment and grant the purchase atomically under a unique send-hash
   constraint. Replays then observe the existing fulfillment.

The complete server-side sequence is in the
[integration model](../guide/integration.md#purchase-state-transitions).

## Properties and methods

```ts
kei.address                        // 'kei_3abc...'
await kei.balance()                // number, in Kei
await kei.send(to, amount)         // { hash, amount, to }
await kei.faucet()                 // testnet only; throws on mainnet
kei.seed                           // export for backup; never log it
await kei.wallet.summary()         // { address, kei, tokens, items, pending } // item summaries include image/description/stats metadata when present
```

| Member | Purpose |
| --- | --- |
| `address` | The account's public Kei address. |
| `balance()` | Read the account's Kei balance. |
| `send(to, amount)` | Sign and send Kei from this account. |
| `faucet()` | Request test funds where a faucet is available. |
| `seed` | Export the wallet credential for backup. Treat it as a secret. |
| `wallet.summary()` | Read the account's Kei, tokens, items, and pending state together. Includes immutable item image/description/stats metadata in each row. |

## Receive events

```ts
kei.on('received', (transaction) => {
  console.log(transaction.from)
  console.log(transaction.amount)
  console.log(transaction.hash)
})
```

The event reports a transaction after the client observes it. Do not treat an
unconfirmed intent or UI action as settlement.

## Payments

```ts
const receipt = await kei.pay({
  to: gameAddress,
  amount: 0.05,
})

await attachPayment(order.id, receipt.hash)
```

A payment is signed by the current wallet. There is intentionally no `from`
argument. A memo has no representation in the current state-block wire format;
`pay({ memo })` fails with `no-memo-yet`. Use the exact send hash rather than an
amount-and-time guess or an application memo.

## Failure cases

| Code or condition | Response |
| --- | --- |
| `no-memo-yet` | Permanent for that request shape. Remove the memo and correlate by hash. |
| Order missing | Keep the confirmed payment record and reconcile after the order arrives. |
| Payment missing | Keep the order record and reconcile after confirmation arrives. |
| Sender or amount mismatch | Refuse fulfillment and investigate; do not coerce the records. |
| Transport failed after a signed write | Refresh account/block state before deciding whether to resubmit. |

See the executable [recovery categories](./errors.md#recovery-categories) for
stable-code handling.

## What `Kei.mock()` proves

The proof executes the current `kei-transaction@0.8.0` client, two account
chains, receive-block lookup, event delivery, stable memo refusal, both event
orderings, and idempotent application reconciliation without a network, secret,
or prompt. The maps deliberately stand in for durable tables: the mock does not
prove database crash safety, public-network uptime, distributed consensus, or
production value.

