---
title: Items
description: Create, mint, transfer, and query Kei-native game items.
---

# Items

Items use the same native asset model as tokens. A unique item has supply `1`
and zero decimals. A supply greater than one describes interchangeable units of
one fungible item type; it is not a collection. A collection is many separate
supply-1 tokens that share an issuer and metadata prefix.

Ownership is durable ledger state. Combat position, cooldowns, animation state,
and other fast-changing facts still belong to the game server; Kei is not a
60 Hz database.

## Run a complete ownership transfer

This no-network playground creates a unique sword, mints it to one wallet,
transfers it with that player's key, and reads the new owner directly from the
ledger.

```sh
bun install --frozen-lockfile
bun run docs/playgrounds/items.ts
# {"kind":"item","item":"Sword of Testing","ownerChanged":true}
```

The docs render the executable file directly, and the site test suite runs it.

<<< ../playgrounds/items.ts

## Create an item type

```ts
const potion = await game.items.create({
  name: 'Health Potion',
  description: 'One interchangeable potion unit.',
  image: './potion.png',
  supply: 100,
  transfer: 'open',
})
```

Omit `supply` for a unique item. Use `transfer: 'none'` for a soulbound item.

| Shape | `supply` | Good fit |
| --- | --- | --- |
| Unique item | omitted (defaults to one) | A named sword or one-off collectible. |
| Fungible item type | a fixed value greater than one | Interchangeable copies, such as potions or ammunition. |
| Soulbound | either shape, with `transfer: 'none'` | Achievements that should never acquire a secondary-market price. |

To model a collection, create many supply-1 item tokens under the same issuer
and give their metadata a shared prefix. Kei deliberately has no collection
primitive; applications may group those item ids for display.

Each item type is an asset and therefore pays the escalating issuance burn.
Do not create a new asset type for every durability change, session, or stack.

## Mint and transfer

```ts
await game.items.mint(sword.id, playerAddress)
await kei.items.transfer(sword.id, recipientAddress)
```

The issuer mints. The current owner signs a transfer. A mint first arrives as a
receivable; call `sync()` before trying to transfer it. The playground keeps
that line visible because removing it produces the useful failure "balance is
0" rather than silently pretending the player already holds the item.

## Query ownership

```ts
await kei.items.owner(sword.id)
await kei.items.ownedBy(playerAddress)
```

Ownership is part of ledger state and can be queried directly; no separate inventory indexer is required.

`owner()` is defined only for a supply-1 item and answers that unique item's
owner. For a fungible item type, query a known account's balance instead.
`ownedBy()` answers the assets a known account holds. It is not a global
catalogue search or marketplace index; a product-wide browse view still needs
the app to know which accounts or item types it intends to read.

## Keep live game state elsewhere

Put durable ownership on the ledger. Keep rapidly changing state such as durability ticks, live stack counts, position, or cooldowns in the game system that owns the real-time loop.

The practical split is:

| Fact | Authority |
| --- | --- |
| Who owns the sword | Kei ledger |
| Whether the sword may transfer | Immutable asset policy on the Kei ledger |
| Current durability, equipped slot, attack animation | The game system that owns the live loop |

The playground proves creation, receivable collection, player-signed transfer,
and ownership lookup against the deterministic mock. It does not prove a public
network's uptime or make the item valuable.
