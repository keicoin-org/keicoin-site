---
title: Security rules
description: Non-negotiable security constraints for a Kei game economy.
---

# Security rules

These constraints follow from who can sign a transaction. They are part of the integration model, not optional hardening.

## Never ship an issuer seed to a browser

Use `Kei.server()` only in a server process and load its seed from server-side secret storage.

Do not put an issuer seed in:

- client environment variables;
- a frontend bundle;
- local storage;
- source control;
- logs or analytics events.

Anyone with that seed can mint as the issuer.

## Never invent delegated charging

There is no API that lets the game sign a debit from a player's wallet. A purchase is two transactions:

1. the player signs payment;
2. the issuer signs delivery.

If application code appears to charge another account without that account signing, the design is wrong.

## Do not hold player balances on the game server

The chain owns balances. A server may cache a balance for display, but it must not become the authoritative ledger. Otherwise a server compromise, rollback, or database restore becomes an economic event.

## Choose transfer policy before issuance

Transfer policy is protocol-enforced and immutable:

| Policy | Meaning |
| --- | --- |
| `open` | Players can transfer to each other. |
| `issuer-only` | Transfers must involve the issuer. |
| `none` | Units cannot be transferred; they can only be burned. |

There is no migration that changes this later. Issue a replacement asset if the policy was wrong.

## Treat delivery handlers as financial code

Before delivering an asset, validate the confirmed payment's recipient, amount, send-block purchase identifier, and whether it has already been fulfilled. `pay()` returns the send hash; `onPayment.hash` is the receive hash, whose block `link` names that send. Persist orders and payments independently, reconcile after either arrives, and enforce a durable unique fulfillment record. Payment memos have no representation in the current wire contract.

::: warning Pre-release network
The public M3 testnet is one rate-limited, best-effort dev node with weak consensus, no uptime promise, published dev keys, and no monetary value. Native M4 claims pass the pinned SDK contract against a clean node startup in CI, but this guide does not claim they are deployed to the public endpoint yet. These rules describe the API and ledger model, not a production-ready network. Nothing on Kei holds value today.
:::
