---
title: Security rules
description: Keep signer, ledger, game-state, indexing, fulfillment, and recovery authority separate.
---

# Security rules

## Outcome

Keep a Kei integration from turning a game database into a second ledger or a
server into a delegated player wallet. The runnable payment proof exercises the
two hash identities, both arrival orderings, a durable-idempotency model, and
the stable refusal for a memo the wire cannot carry.

## Run the security proof

```sh
bun install --frozen-lockfile
bun run docs/playgrounds/payment-reconciliation.ts
# {"kind":"payment-reconciliation","scenarios":[{"ordering":"order-first","linkMatches":true,"deliveries":1},{"ordering":"payment-first","linkMatches":true,"deliveries":1}],"memoRefusal":"no-memo-yet"}
```

<<< ../playgrounds/payment-reconciliation.ts

## Authority and trust boundary

| Capability | Who may exercise it |
| --- | --- |
| Player key: sign a send, transfer, claim, or market accept | That player's wallet only. |
| Issuer key: issue, mint, publish a root, or close a root | The issuer key in a server process. |
| Balances and ownership | The ledger after accepted blocks. |
| Realtime game state: position, combat, and presence | The game simulation, without economic custody. |
| Indexing: choose accounts/catalogue entries to display | A bounded application index, without settlement authority. |
| Recovery | Whoever controls an intentional seed backup/custody mechanism; there is no implicit recovery service. |

## Security state transitions

1. A player signs a concrete transaction in their wallet.
2. The ledger accepts or refuses it with a stable result.
3. The receiving application reads the accepted block rather than trusting a UI
   intent or webhook body.
4. Application reconciliation joins that block to its own context by exact hash.
5. A unique durable fulfillment record prevents replay before the issuer signs
   delivery.

Any shortcut that moves economic authority into a cache, callback, or game-state
row creates a second ledger.

## Never ship an issuer seed to a browser

Use `Kei.server()` only in a server process and load its seed from server-side
secret storage. Do not put an issuer seed in client environment variables, a
frontend bundle, local storage, source control, logs, or analytics events.

Anyone with that seed can mint as the issuer.

## Never invent delegated charging

There is no API that lets the game sign a debit from a player's wallet. A
purchase is two transactions:

1. the player signs payment;
2. the issuer signs delivery.

If application code appears to charge another account without that account
signing, the design is wrong.

## Do not hold player balances on the game server

The chain owns balances. A server may cache a balance for display, but it must
not become the authoritative ledger. A rollback or restore of an application
database must not create or destroy a player's economic state.

## Choose transfer policy before issuance

Transfer policy is protocol-enforced and immutable:

| Policy | Meaning |
| --- | --- |
| `open` | Players can transfer to each other. |
| `issuer-only` | Transfers must involve the issuer. |
| `none` | Units cannot be transferred; they can only be burned. |

There is no migration that changes this later. Issue a replacement asset if the
policy was wrong.

## Treat delivery handlers as financial code

Validate the confirmed recipient, sender, amount, send-block purchase identifier,
and fulfillment state before delivery. `pay()` returns the send hash;
`onPayment.hash` is the receive hash, whose block `link` names that send. Persist
orders and payments independently and reconcile after either arrives.

Payment memos have no wire representation. A `no-memo-yet` refusal is safer than
silently dropping application identity; the send hash is the exact key.

## Failure cases

| Failure | Safe response |
| --- | --- |
| Seed reaches a client/log | Treat it as compromised and rotate/migrate deliberately; deleting the log is not recovery. |
| Signed write loses its reply | Refresh/reconcile account and block state before considering replay. |
| Stale offer or claim | Refresh ledger state; do not force the old intent through. |
| Fulfillment callback repeats | Return the existing unique fulfillment result. |
| Player loses an unrecoverable seed | State the custody loss honestly; the issuer cannot forge ownership recovery. |

The executable classifier in [Errors](../reference/errors.md#recovery-categories)
keeps retry, refresh, and permanent refusal separate. Before you branch on a
code, check [where that code comes from](../reference/errors.md#where-the-code-comes-from-decides-whether-it-is-stable):
a refusal the node raised arrives as `node-error`, and the granular codes the
mock returns for the same attempt are not sent over the wire.

## Screenshot evidence

No screenshot is included in this slice. Hash linkage, signer authority, refusal
codes, and idempotency are not visible UI states, so a capture would be
decorative rather than evidence. A runtime capture must record repository
revision, command or URL, network/mock mode, viewport, scenario state, alt text,
review date, and the owner responsible for noticing stale proof. Do not replace
those fields with an illustrative mockup.

The rule applies to the captures already on this site. Every image under
`/img/docs/` carries a provenance record beside it, written once in
`docs/evidence/` and rendered wherever the image appears. A capture whose
revision or scenario is **Not recorded** cannot be re-created, so it is labelled
an illustration and no page may lean on it. The two gameplay captures — on the
[Button](/examples/button) and [World of Wonder](/examples/world-of-wonder)
pages — are both in that state today, and replacing them means capturing again
from a pinned revision rather than editing the record. `docs-proof.test.ts`
fails when an image appears without its record, when a record is missing a
contract field, or when a record drops the illustration label while a field is
still unrecorded.

## What `Kei.mock()` proves

The proof uses current released code to exercise signer separation, confirmed
send/receive linkage, stable memo refusal, both event orderings, and one
idempotent reconciliation path. It does not prove secret-store isolation,
database atomicity, browser compromise resistance, account recovery,
public-network durability, distributed consensus, or monetary value.

The [public testnet proof](../reference/testnet.md) is the one playground here
that does publish blocks to `https://testnet.keicoin.org/rpc`. It settles a
rooted claim and an atomic swap there, and it records where the node's refusals
differ from the mock's. It still proves nothing about production readiness: one
node accepting blocks is a working API, not consensus.

::: warning Pre-release network
The public testnet is one rate-limited, best-effort dev node with weak consensus,
no uptime promise, published dev keys, and no monetary value. One node accepting
blocks is a working API, not production consensus. Nothing on Kei holds value
today.
:::
