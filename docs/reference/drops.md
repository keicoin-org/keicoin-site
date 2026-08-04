---
title: Loot tables
description: Publish a weighted drop batch bound to the table players were shown, and let each player verify and claim their own award.
---

# Loot tables

A drop table is a [batch reward](./claims.md) with one extra promise attached:
the batch was published for the odds the player was shown. The table — every
asset, every amount, every weight — hashes to a digest, and that digest goes
into the salt of the root the issuer publishes. A game that rewrites the table
after the fight changes the digest, and no nonce recovers the salt inside a root
the ledger has already accepted.

It ships in [`@keicoin/economy`](https://www.npmjs.com/package/@keicoin/economy)
at `0.2.2` and installs with `kei-transaction@0.8.0`; `defineDropTable`,
`kei.economy.drop()` and `kei.economy.verifyDrop()` are reachable from a plain
install. The package is the source of truth for the API — this page is a worked
path through it.

::: warning This is not verifiable randomness
The roll happens on the game's server, out of the chain's sight, and nothing
here proves the declared weights were honoured. A game that publishes a 1% crown
and never rolls one is not caught by this. What is caught is the duller and
larger class: a table rewritten between the announcement and the drop, an award
for a row the table never listed, an amount nobody was promised, and an award
minted for one player and handed to another.
:::

## Run a whole batch locally

This playground issues `GOLD` and a `SWORD`, declares a three-row table, rolls
it for three players with a fixed random source, and asserts what each one gets
— including the player who rolls nothing. It then verifies an award, refuses a
rewritten table, claims, refuses the duplicate claim block, and closes the
batch. It runs against `Kei.mock()`: no network request, no key, and nothing in
it has value.

From a clone of the site:

```sh
bun install --frozen-lockfile
bun run docs/playgrounds/drops.ts
# {"kind":"drop","roots":2,"awarded":2,"missed":1,"goldQuantity":50,"goldChance":0.6,"closed":2}
```

The checked-in file below is the file that command executes; the test suite runs
the same file, so the displayed API cannot drift into pseudocode.

<<< ../playgrounds/drops.ts

## Declare the table in a file both halves import

`defineDropTable()` reads no chain and signs nothing. That is what makes the
digest worth anything: the player's copy of the odds is not a copy the server
sent them.

| Field | Meaning |
| --- | --- |
| `id` | Stable name for the table, shared by server and browser. |
| `drops[].asset` | An asset id, `{ id }`, or `{ symbol, issuer }` — the last one survives being written before the asset exists. |
| `drops[].amount` | How much falls out. Defaults to 1, which is the item case. |
| `drops[].weight` | Relative likelihood against every other row and against `nothing`. Default 1. |
| `nothing` | How often the table pays out nothing, weighted against the rows. Default 0. |
| `issuer` | The account that publishes batches and issues what drops. |

Omitting `issuer` on a table that names an asset by bare symbol is refused at
verification with `unanchored-table`, rather than verified against whichever
account turned up. Letting a batch name its own issuer is letting a stranger
decide what `{ symbol: 'GOLD' }` meant.

The published `odds` are derived, not declared: each row's `chance` is its
weight over the total, and the `nothing` row is last.

## Publish one batch, not one mint per player

`economy.drop(table, players)` rolls once per address and publishes **one commit
block per asset**, however many players rolled it. Nothing is minted there. The
mint happens in each player's own claim, written from their own account, in
parallel — which is the only reason a boss killed by a thousand people is not a
thousand writes queued behind the issuer's chain.

| Call | Who signs | What it writes |
| --- | --- | --- |
| `economy.drop(table, players)` | The issuer | One `commit` block per asset in the batch |
| `economy.verifyDrop(award)` | Nobody | Nothing — it is a read and some arithmetic |
| `claims.add(award)` | The player | One claim block on the player's own chain |
| `drop.close()` | The issuer | Closes every root in the batch |

A player who rolled nothing gets `awardFor(address) === null`. A miss is an
outcome, not an error.

## Verify before claiming

`verifyDrop()` returns the row the award matched and that row's published
chance, so the player can be shown what they got and how likely it was. It
refuses when the root is not on this network, when the salt is not the one this
table and nonce produce (`table-changed`), when the player's leaf is not under
that root, or when the asset and amount are not a pair the table declares.

`claims.add()` is idempotent: a bundle it has already claimed produces no second
block and no error, which is what makes it safe to call on every page load. The
ledger's own refusal of a duplicate entitlement shows up when the claim block is
written directly, with `claims.claim()`.

## Close the batch deliberately

`drop.close()` refuses while anybody still holds an unclaimed entitlement,
because closing over one is not housekeeping — it is taking their loot back.
`close({ force: true })` is the issuer saying so on purpose. Roots are closed by
the issuer rather than by a clock, because a block lattice has no clock, and
closing is what lets a settled batch be pruned.

## What the playground proves, and what it does not

It proves the binding: the digest, the salt path, the leaf, the row match, the
duplicate refusal, and the close refusal, all enforced rather than asserted in
prose. It runs on the mock chain, which applies the same ledger rules as the
node client.

It does not prove the roll was fair, that a drop batch has been settled on the
public testnet, or that anything here has value. Rooted claims and swaps do
settle on the public node; the commands behind that measurement, and the
network's limits, are on [project status](https://keicoin.org/status). There is
no mainnet.
