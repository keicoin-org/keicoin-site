---
title: Batch rewards
description: Publish one rooted reward batch, claim from player accounts, and close it explicitly.
---

# Batch rewards

## Outcome

One issuer block publishes a Merkle root for a batch. Each player then writes
their own claim block. The proof below publishes a two-recipient root, merges two
entries for one account, claims from that player's wallet, rejects the same claim
twice, closes the root as the issuer, and rejects a later claim.

## Run the claims proof

```sh
bun install --frozen-lockfile
bun run docs/playgrounds/claims.ts
# {"kind":"claims","published":true,"mergedRecipients":2,"claimed":50,"duplicateRefusal":"already-claimed","proofLimitRefusal":"bad-block","closedRefusal":"root-closed"}
```

The displayed source is the exact executed file.

<<< ../playgrounds/claims.ts

## Authority and trust boundary

| Fact | Authority |
| --- | --- |
| Asset and root publication | The issuer's signed account chain. |
| Entitlement contents | The batch and proof bundle the game gives the named player. |
| Proof validity and duplicate status | The node, against the published root and `(account, root)` claim index. |
| Claim write | The player's key and account chain, never the issuer. |
| Root closure | An explicit issuer-signed `commit_close`, not a clock. |

The proof bundle is not authority by itself. A changed account, asset, amount,
or sibling path fails against the root the ledger accepted.

## Claim state transitions

1. `token.commit(entries)` merges duplicate recipients and publishes one open
   root.
2. `drop.proofFor(address)` gives that account its amount and sibling path.
3. `kei.claims.add(bundle)` stores the bundle and, by default, claims from the
   player's own account.
4. A second claim from the same `(account, root)` is `already-claimed`.
5. `token.close(root)` is an issuer write. Once closed, every still-unclaimed
   bundle for that root is dead and a direct claim is `root-closed`.

There is no consensus expiry time. A game may publish a claim policy, but only
the issuer's close block changes ledger state.

## Batch and proof limits

These are the current 0.8 wire and tree bounds, not recommended batch sizes:

| Bound | Current rule |
| --- | --- |
| Entries | Non-empty; every amount is positive. |
| Recipient leaves | One per account per root; repeated entries merge. |
| Published count | Unsigned 32-bit: 1 through 4,294,967,295 recipients. |
| Proof path | At most 48 sibling hashes. |
| Root identity | Salted, so otherwise identical batches still produce distinct roots. |

Memory, transport, and product delivery limits will normally be lower. Measure a
real batch before choosing its size; do not read the uint32 ceiling as an
operational target.

## Failure cases

| Code | Meaning and response |
| --- | --- |
| `already-claimed` | Refresh claim state. The entitlement already materialized; never grant it again off-chain. |
| `root-closed` | Permanent for that root. Ask the issuer for a current published reward, if policy permits. |
| `bad-proof` | Permanent for that bundle. Re-fetch it; do not alter an amount or proof locally. |
| `bad-block` for 49 proof siblings | The current wire ceiling is 48. Split the batch shape rather than bypassing it. |
| `not-in-commit` | The account has no leaf in this batch. Do not invent one. |
| `empty-commit` or `bad-amount` | Correct the issuer input before publishing. |

The general handling table is in [Errors](./errors.md#recovery-categories).

## What `Kei.mock()` proves

The playground uses the released SDK's commit, `commitInfo`, proof, player claim,
balance, duplicate index, close, and closed-root refusal paths. It proves the
protocol-shaped state machine in one process. It does not prove public-network
durability, issuer policy fairness, proof delivery uptime, distributed
consensus, or production batch throughput.
