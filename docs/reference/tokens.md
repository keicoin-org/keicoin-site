---
title: Tokens
description: Issue, mint, burn, query, and transfer Kei-native tokens.
---

# Tokens

Tokens are native ledger assets. The issuer creates supply; player wallets hold and transfer it according to the asset's immutable transfer policy.

The issuer and the player are deliberately different wallets. The issuer can
create supply; a player can only move units that their own key controls. Keep the
issuer seed on a server — `Kei.server()` refuses to open it in a browser.

## Run a complete currency locally

This playground issues `GEM`, mints 500 units to one player, transfers 125 to a
second player, and asserts both balances. It uses `Kei.mock()`: there is no
network request, no signup, and nothing in the example has value.

From a clone of the site:

```sh
bun install --frozen-lockfile
bun run docs/playgrounds/currency.ts
# {"kind":"currency","player":375,"friend":125,"total":500}
```

The checked-in file below is the file that command executes; the test suite runs
the same file so the displayed API cannot drift into pseudocode.

<<< ../playgrounds/currency.ts

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

The burn rises with the number of assets issued by this account: the first
asset burns 1 Kei, the second burns 2, and the nth burns n. This discourages
unbounded catalogue spam without adding a fee to ordinary transfers.

## Choose the transfer policy before issuance

`transfer` is enforced by the ledger and cannot be changed later. It is the
decision that determines whether a player market can exist.

| Policy | What the ledger permits | Use it for |
| --- | --- | --- |
| `open` | Any holder can transfer to another account. A third-party market can exist. | Tradable currency and items. |
| `issuer-only` | Units move only to or from the issuer. Players cannot trade with each other. | Closed game economies. |
| `none` | Units cannot transfer after minting; they can only be burned. | Soulbound achievements or reputation. |

There is no setting that allows open player transfer while forbidding a
third-party market. If players can transfer an asset, somebody can list it.

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
the current `kei-transaction@0.7.0`. It was master-only for as long as 0.4.0 was
the current release, and this page said so. [Status](https://keicoin.org/status)
carries the installable-versus-merged line for what is still on the other side
of it.

## Player methods

```ts
const gems = await kei.token('GEM', issuerAddress)

await gems.balance()
await gems.transfer(toAddress, 120)
```

`transfer()` has no `from` argument. The wallet that signs the transaction is the sender.

## Identity and idempotency

Token identity includes the issuer. Do not treat the symbol alone as globally unique. Issuance is idempotent for the same issuer and symbol.

## What the playground proves

The mock enforces the same asset identity, issuance burn, supply cap,
receivable arrival, transfer policy, and balance rules as the SDK's node client.
It proves the integration flow without depending on network uptime. It does not
prove public-testnet availability, distributed consensus, or monetary value.

For a network run, change only the transport and credentials deliberately; do
not copy the fixed documentation seed onto a public node. The current network
boundary and commands behind its claims are on [project status](https://keicoin.org/status).
