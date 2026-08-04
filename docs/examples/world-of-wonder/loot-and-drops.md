---
title: Loot and drops
description: "World of Wonder's phase-one reward boundary: legacy inventory is inert, rewards refuse until wallet proof exists, and the tested mint path behind that refusal."
---

# Loot and drops

**World of Wonder no longer pays a kill into `PlayerSchema.gold` or turns a pickup into a `character_inventory` row. It also does not pay those rewards on-chain in a running server yet.** Merged [phase one](https://github.com/keicoin-org/world-of-wonder/pull/8) removes the database as a second economy and fails closed while wallet ownership proof is unavailable.

This page separates three states that are easy to collapse into one claim:

1. the old database reward path is gone from gameplay authority;
2. a direct, idempotent chain-mint path exists and is tested behind a stub verifier;
3. the running server wires `proofUnavailable`, so no character can bind a wallet and those rewards refuse today.

## Before you begin

| | |
| --- | --- |
| A running fork | `git clone https://github.com/keicoin-org/world-of-wonder`, then the [run steps](../world-of-wonder.md#run-it) |
| Node | 20.17 or later |
| Which chain | `KEI_NETWORK=mock` is the no-secret local mode |
| Current authority | `src/server/kei/Inventory.ts` |
| Legacy evidence only | `src/server/kei/Legacy.ts` reads old inventory, equipment, and gold rows so the player can be told they are inert |
| Behavioural proof | `npm run test:inventory` |

## What happens on a kill today

![World of Wonder gameplay view with character, village, combat hotbar, chat, and HUD](/img/docs/world-of-wonder-gameplay.webp)

*This is the combat world where server-authored rewards originate. It is not proof that a reward reached a wallet.*

The upstream loot table still decides what can drop. Enemy records carry a gold range and point at item rows such as:

```ts
new LootTableEntry('sword_01', 10, 1, 1, 1, 1)
//                  item key   chance  quantity  level
```

The server still owns that game-design decision and still resolves kills. What changed is where the result is allowed to go:

| Result | Current default-branch behaviour |
| --- | --- |
| Experience | Added to character progression in the database. Experience is not money or an item. |
| Kill gold | `dropCTRL.addGold()` asks the inventory authority to pay reward id `kill:<enemy session id>`. The request is refused because the character has no proven wallet. Nothing is added to `PlayerSchema.gold`. |
| Item roll | A server-authored loot entity can still appear on the ground. |
| Pickup | `pickupItem()` checks for a bound wallet before removing the entity. With the shipped verifier there is no binding, so the item stays on the ground and nothing is minted. |
| Quest gold or items | The quest is server-resolved, but its `quest:<character>:<quest>` payment is refused for the same missing binding. Nothing is written into legacy economy rows. |

The refusal is visible in chat. A silent fallback would make a database number look like ownership again, so there is deliberately no fallback.

## The old rows are evidence, not authority

`character_inventory`, `character_equipment`, and the old `gold` column are not deleted during phase one. They may contain a player's pre-migration state, and deleting or rewriting them before a wallet migration exists would destroy the only record of what needs to be resolved.

They are read once on join to report how many legacy rows exist. They are not loaded into the room's usable bag, do not authorize an equip or consume, and are not rewritten by autosave. Inserting a sword directly with SQL changes no chain holding and grants no gameplay authority.

This is the boundary to keep:

| State | Usable ownership? |
| --- | --- |
| A legacy inventory or equipment row | No — retained migration evidence only |
| A client-supplied Kei address | No — an address is not proof of control |
| A chain holding under a proven address | Yes in `Inventory.authorize()`; the running game has no proof route yet |
| An item locked in an open offer | No for gameplay — the chain no longer reports it as spendable ownership |

## What is already implemented behind the refusal

`Inventory.ts` contains the service phase two can wire rather than a database workaround:

- `challenge(characterId)` creates a server-issued, domain-separated, single-use challenge.
- `bind(characterId, proof)` accepts only a verifier-approved address/signature pair for that exact challenge.
- `authorize(characterId, item, quantity)` re-reads the bound address's holdings; it does not cache a balance that can become stale when another tab lists the item.
- `pay(characterId, reward)` records a server-authored reward id before minting gold or items to the bound address.

The payment id is what prevents a replay from minting twice. Kills use the enemy session id, pickups use the loot entity id, and quests use the character and quest key. An in-process `settling` set closes the two-messages-in-one-tick race; `reward_payments` closes the ordinary restart replay.

Recording before minting chooses the safe failure direction: a crash in between can underpay one reward, but cannot reopen it and mint without bound after restart. That is a support problem instead of a printing press.

::: warning The verifier and gameplay wiring are still missing
The service has a proof interface, but `src/server/index.ts` supplies `proofUnavailable`. There is no browser route that asks for the challenge, no SDK ownership-challenge signing helper, and no server verifier connected to gameplay. `authorize()` is proved directly in the test; equipping and consuming are not a live end-to-end wallet flow.
:::

Dropping also remains refused even after a future binding. A wallet-held item cannot become a ground mint merely because the room received a message; the player must sign the item away or the result would be a duplicate.

## Direct mint now, rooted claims later

The phase-one service uses issuer-signed `grant` and `deliver` calls. That is simple and correct for the construction-scale test, but every reward serialises through the issuer's account chain. A busy game should batch rewards with rooted claims rather than turn every kill into an issuer write.

That later path has a different custody split:

| Concern | Whose job |
| --- | --- |
| Decide whether the kill happened | Colyseus, server-side |
| Decide the reward | The server's loot table — design, not custody |
| Publish a batch root | The issuer |
| Deliver the recipient-bound proof | The authenticated game session |
| Publish the claim | The player's wallet |
| Refuse forged, altered, reused, or misdirected claims | The ledger |

Rooted claims remove the issuer write bottleneck. They do not prove a kill happened, bind a socket to a wallet, or make a proof bundle safe to publish. Those remain game-authentication responsibilities.

## Check the boundary

```sh
git clone https://github.com/keicoin-org/world-of-wonder
cd world-of-wonder
npm ci
npm run test:inventory
```

The named checks prove that the shipped verifier refuses a forged proof, a challenge must be issued and is single-use, a database sword and gold authorize nothing, a minted sword does authorize after a stub-verified binding, an open offer locks it out, and the same reward id pays once across a replay, a same-tick duplicate, and a fresh authority reading the existing payment records.

They do **not** prove the missing browser-to-server wallet binding, a live pickup, a live equip, crash recovery between the payment record and the mint, scale, or a public deployment.

## Next steps

- [Batch rewards](../../reference/claims.md) — the rooted-claim path for scaling past one issuer write per reward.
- [Items reference](../../reference/items.md) — the chain asset a reward delivers.
- [Auction house integration](./auction-house.md) — the working player-to-player market path.
- [Security rules](../../guide/security.md) — why a client-supplied address or payout request is not authority.
- [World of Wonder](../world-of-wonder.md) — the full fork and its remaining limits.
