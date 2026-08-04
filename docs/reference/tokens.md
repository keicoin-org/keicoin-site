---
title: Tokens
description: Issue, mint, burn, query, and transfer Kei-native tokens.
---

# Tokens

Tokens are native ledger assets. The issuer creates supply; player wallets hold and transfer it according to the asset's immutable transfer policy.

## Issue a token

```ts
const gems = await game.token.issue({
  name: 'Gems',
  symbol: 'GEM',
  decimals: 0,
  maxSupply: 1_000_000,
  transfer: 'open',
  swap: 'one-way',
  rate: 100,
})
```

| Option | Meaning |
| --- | --- |
| `name` | Human-readable asset name. |
| `symbol` | Asset symbol. Combined with the issuer address to identify the token. |
| `decimals` | Display precision. |
| `maxSupply` | Optional cap on circulating supply. |
| `transfer` | `'open'`, `'issuer-only'`, or `'none'`; protocol-enforced and immutable. |
| `swap` | `'two-way'`, `'one-way'`, or `'off'`; an issuer promise recorded on-chain. |
| `rate` | Issuer-side configuration, not an on-chain market price. |

Issuance burns Kei because every asset creates permanent ledger state. Ordinary token transactions remain feeless.

## Issuer methods

```ts
await gems.mint(playerAddress, 500)
await gems.balanceOf(playerAddress)
await gems.supply()
```

```ts
await gems.burn(500)   // issuer-only; burns from the issuer's own balance
```

`burn()` shipped in `@keicoin/tokens@0.5.0` on 4 August 2026 and installs with
`kei-transaction@0.5.0`. It was master-only for as long as 0.4.0 was the current
release, and this page said so. [Status](https://keicoin.org/status) carries the
installable-versus-merged line for what is still on the other side of it.

## Player methods

```ts
const gems = await kei.token('GEM', issuerAddress)

await gems.balance()
await gems.transfer(toAddress, 120)
```

`transfer()` has no `from` argument. The wallet that signs the transaction is the sender.

## Identity and idempotency

Token identity includes the issuer. Do not treat the symbol alone as globally unique. Issuance is idempotent for the same issuer and symbol.
