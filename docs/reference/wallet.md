---
title: Wallet
description: Kei wallet properties, events, balances, and transfers.
---

# Wallet

`Kei.start()` returns the player-side client. Its wallet owns one account and signs only for that account.

## Properties and methods

```ts
kei.address                        // 'kei_3abc...'
await kei.balance()                // number, in Kei
await kei.send(to, amount)         // { hash, amount, to }
await kei.faucet()                 // testnet only; throws on mainnet
kei.seed                           // export for backup; never log it
await kei.wallet.summary()         // { address, kei, tokens, items, pending }
```

| Member | Purpose |
| --- | --- |
| `address` | The account's public Kei address. |
| `balance()` | Read the account's Kei balance. |
| `send(to, amount)` | Sign and send Kei from this account. |
| `faucet()` | Request test funds where a faucet is available. |
| `seed` | Export the wallet credential for backup. Treat it as a secret. |
| `wallet.summary()` | Read the account's Kei, tokens, items, and pending state together. |

## Receive events

```ts
kei.on('received', (transaction) => {
  console.log(transaction.from)
  console.log(transaction.amount)
  console.log(transaction.hash)
})
```

The event reports a transaction after the client observes it. Do not treat an unconfirmed intent or UI action as settlement.

## Payments

```ts
await kei.pay({
  to: gameAddress,
  amount: 0.05,
})
```

A payment is signed by the current wallet. There is intentionally no `from` argument.
Save the returned send-block `hash` with the order over your normal server channel. `onPayment.hash` is the receiver's receive-block hash; resolve it with `game.client.node.blockInfo()` and correlate using that block's `link`. Persist both sides and reconcile after either arrives. Payment memos have no representation in the current wire contract, so `pay({ memo })` is rejected rather than silently ignored.
