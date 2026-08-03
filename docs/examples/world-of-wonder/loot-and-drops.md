---
title: Loot and drops
description: How World of Wonder's kill rewards actually work today — upstream tables, database inventory — and the commit-and-claim migration that would put them on the chain.
---

# Loot and drops

**By the end of this page you know exactly where a killed enemy's gold, experience and items go in World of Wonder today, why none of it reaches the chain-backed bag, and what a migration to commit-and-claim has to prove before it is safe to wire up.**

This is the honest counterpart to [Auction house integration](./auction-house.md). The auction house is finished and settles on-chain. Loot is not: the fork's README lists loot and quest rewards as an unfinished SPEC gap, and this page is the map of that gap rather than a workaround for it.

## Before you begin

| | |
| --- | --- |
| A running fork | `git clone https://github.com/keicoin-org/world-of-wonder`, then the [run steps](../world-of-wonder.md#run-it) |
| Node | 20.17 or later |
| SDK | The released `kei-transaction` package — a plain npm dependency, no sibling checkout |
| Which chain | `KEI_NETWORK=mock` is right while you are reading |
| What you are reading | `src/server/…/LocationsDB.ts`, `abilityCTRL.ts`, `PlayerSchema.ts`, `Database.ts` — all upstream files, all unchanged by the fork |
| What you are **not** reading | `src/server/kei/` — the issuer and the market have no part in loot today |

You do **not** need a new asset, a new endpoint, or a wallet call to follow the current flow. Every line of it is database-side.

## What happens on a kill today

![World of Wonder gameplay view with character, village, combat hotbar, chat, and HUD](/img/docs/world-of-wonder-gameplay.webp)

*This is the combat world where the upstream server-side drops described below originate. It is not proof of on-chain loot — nothing in this screen has touched the chain.*

Loot is a table on the location record. `LocationsDB.ts` defines a single `DEFAULT_LOOT`, and enemy records point their `drops` at it rather than carrying their own. Each row is a `LootTableEntry` — an item key, a chance, a quantity range and a level range:

```ts
// LocationsDB.ts — the shape of one row
new LootTableEntry('sword_01', 10, 1, 1, 1, 1)
//                  itemKey    chance  qty 1..1  level 1..1
```

Every entry in `DEFAULT_LOOT` fixes quantity at `1..1` and level at `1..1`, so the only thing that varies between rows is which item and how likely:

| Item | Chance |
| --- | --- |
| Blue potion | 40 |
| Red potion | 25 |
| Sword (`sword_01`) | 10 |
| Shield | 5 |
| Armor | 5 |
| Amulet | 1 |

How those chances are rolled is upstream's business — the fork changed none of it.

Alongside the table, each enemy record defines `goldGain` and `experienceGain`. Those are flat numbers on the enemy, not entries in the loot table, which is why gold and items travel down two different paths from the same kill.

`abilityCTRL.ts` is where the kill is resolved. On death it constructs a `dropCTRL`, then does three things in order:

```
addExperience(...)   →  experience onto the character
addGold(...)         →  goldGain onto PlayerSchema.gold
dropItems(...)       →  rolls DEFAULT_LOOT and spawns what dropped into the world
```

Nothing there is signed, and nothing there is on the chain. `addGold` moves a `uint32` on the room's player schema.

Picking a drop up goes through `PlayerSchema.pickupItem`, which puts the item into the Colyseus player inventory. `Database.ts` persists that inventory as `character_inventory` rows. So the full journey of a dropped sword is: a table row on a location → a spawned entity in the room → a Colyseus inventory slot → a row in SQLite.

## Current boundary

::: danger These drops do not exist on the chain, and the bag will not show them

The fork's bag panel deliberately renders `wallet.inventory` — the player's on-chain item balances. Upstream loot never reaches `wallet.inventory`; it reaches `character_inventory`. So a sword that drops from a kill is **invisible in the bag**, cannot be listed in the auction house, and cannot be sold to the vendor.

That is not a bug to route around. Merging `character_inventory` into the bag would make database rows look like on-chain ownership, which is the one thing this fork exists to stop.

**There is no network loot claim in World of Wonder today.** No endpoint mints a drop, no wallet call claims one, and nothing below should be read as describing shipped behaviour. The next section is a design, and it is unbuilt.
:::

Two clean statements to hold onto:

| | Works today | Chain-backed |
| --- | --- | --- |
| Buying and selling at the vendor | Yes | Yes |
| Listing and buying in the auction house | Yes | Yes |
| Gold and experience from a kill | Yes | **No** — `PlayerSchema.gold`, a database number |
| Items from a kill, and picking them up | Yes | **No** — `character_inventory` rows |
| A dropped item appearing in the bag | **No** | — |

## The intended migration: commit, then claim

The SDK path that fits this is the one already documented under [Batch rewards](../../reference/claims.md). The issuer commits a batch of drops — **one issuer block per distinct item asset**, not one for the whole mixed batch — and each player publishes their own claim.

```ts
// Issuer side — one call, however many recipients; one commit back per item.
const drops = await game.items.commit([
  { to: playerA.address, item: potion.id },
  { to: playerB.address, item: potion.id },
  { to: playerA.address, item: sword.id },
])
// drops.length === 2 — the potion's commit and the sword's, each with its own
// root, its own `recipients`, and its own `proofFor(address)`.
```

```ts
// Player side — only an eligible holder can claim, and only they can sign it.
for (const drop of drops) {
  const holders = [playerA, playerB].filter((who) => drop.recipients.includes(who.address))
  for (const who of holders) await who.claims.add(drop.proofFor(who.address))
}
```

That loop is the shape the SDK's own `items.test.ts` uses, where issuer and players share one process. In the fork they would not: `proofFor` runs issuer-side, and the bundle it returns travels to the player over the authenticated game service before the wallet signs anything.

Why this shape rather than a mint per kill: one account has one chain, so an issuer minting once per drop serialises the whole world's loot behind a single chain. Committing a batch removes that bottleneck — claims land independently and in parallel, each on its own player's chain.

::: warning Commit-and-claim removes the issuer bottleneck. It does not decide who deserves a drop.
The ledger will check the proof. It will reject a forged bundle, a changed amount, a claim for another account, and a second claim from the same account. It will not tell you whether the player actually killed anything.

The game still has to authenticate the gameplay that earned the reward. Getting that wrong commits real assets for fake kills, and the chain will faithfully settle every one of them — the proof is bound to its recipient, so it protects who can claim, never whether the kill happened.
:::

Where that leaves responsibility:

| Concern | Whose job |
| --- | --- |
| Did this player kill this enemy? | Colyseus, server-side, exactly as today |
| What does that kill pay? | The server's loot table — design, not custody |
| Committing the batch | The issuer, in one call — which lands one block per distinct item |
| Getting each bundle to its recipient, privately and reliably | Your existing authenticated game service |
| Publishing the claim | **The player's wallet.** Nobody else can sign it. |
| Refusing a forged, altered, reused or misdirected claim | The ledger |

## Rules for whoever wires this up

In order of how expensive they are to get wrong:

- **Never mint on request.** An endpoint that hands out an asset because a client asked for it is a printing press — the same rule that killed `POST /kei/sell` in this fork. The kill must be resolved server-side first, and the commit must react to it.
- **The proof bundle is recipient-bound, and still not public.** The leaf commits to the recipient's account, so a bundle that reaches the wrong wallet cannot be claimed by it — the ledger rejects a claim for another account. What misdelivery costs you is different: it leaks who is entitled to what, and it lets whoever holds the bundle withhold or delay the delivery the rightful player is waiting on. Deliver it over the authenticated private session that already knows who this character is; do not put it anywhere a client can enumerate.
- **The player signs their own claim.** Do not hold player keys to "help" them claim. The wallet is the browser's, and the game never holds that key.
- **Do not merge `character_inventory` into the bag.** Until an item is claimed on-chain, it is a database row, and showing it as ownership is a lie the fork is built to avoid.
- **Close commitments on a published policy**, with `close(root)` after the claim period you told players about — not whenever it is convenient.
- **Keep the chain off the 60 Hz loop.** Commit on a batch cadence. A kill resolving at frame time cannot wait on a ledger.

## State and errors

The left column is where a reward can be after a kill; nothing below `Committed` exists in the fork today.

| State | What it means | What the player sees |
| --- | --- | --- |
| Killed | `addExperience`, `addGold`, `dropItems` have run | Experience and gold move; the drop spawns in the world |
| Picked up | `PlayerSchema.pickupItem` accepted it | The item is in the Colyseus inventory, persisted to `character_inventory` |
| Not in the bag | The bag renders `wallet.inventory`, which the drop never entered | Nothing — and this is the gap, not a failure |
| Committed *(unbuilt)* | The issuer published a commitment per distinct item, each covering that item's recipients | Nothing yet; a commitment is not a delivery |
| Bundle delivered *(unbuilt)* | The player's proof reached their authenticated session | A claimable reward |
| Claim accepted *(unbuilt)* | The player signed `claims.add(drop.proofFor(their address))` and the ledger took it | The item appears in the bag, and is sellable and listable |
| Forged or altered proof | The bundle does not match the commitment | Rejected by the ledger, not by your server |
| Claim for another account | The bundle was not issued to this address | Rejected by the ledger |
| Second claim, same account | Already claimed | Rejected by the ledger — replay is not your problem to solve |

The last three are the ledger's guarantees and they hold whatever your server does. Everything above them is yours.

## Checks

The current loot path has no Kei tests, because it touches no Kei. What exists today is the economy and market suite:

```sh
npm run test:economy    # the issuer's rules, in-process
npm run test:market     # listing, acceptance, cancellation, trust boundaries
npm run server-build && npm run server-start &
npm run test:e2e        # the same rules across a URL — the one worth trusting
```

To confirm the boundary rather than take this page's word for it:

```sh
npm run server-start &
npm run client-dev      # http://localhost:8080
```

Kill something, pick up the drop, then open the bag. The drop is not there. Buy the same item from the vendor and it is — which is the whole difference, visible in one screen.

If you do build the migration, the test that matters is the one that mirrors `test:e2e`: sign a claim over HTTP from a process sharing no memory with the server, and assert that a second claim from the same account fails.

## Next steps

- [Batch rewards](../../reference/claims.md) — `commit`, `proofFor` and `claims.add` in full.
- [Items reference](../../reference/items.md) — the asset a claimed drop would arrive as.
- [Auction house integration](./auction-house.md) — what a claimed item could then be listed in.
- [Security rules](../../guide/security.md) — why no endpoint here mints on request.
- [World of Wonder](../world-of-wonder.md) — the fork this gap sits in.
