---
title: Items
description: Create, mint, transfer, and query Kei-native game items.
---

# Items

Items use the same native asset model as tokens. A unique item has supply `1` and zero decimals; a collection can use a larger supply.

## Create an item type

```ts
const sword = await game.items.create({
  name: 'Sword of Testing',
  description: 'It tests things.',
  image: './sword.png',
  supply: 100,
  transfer: 'open',
})
```

Omit `supply` for a unique item. Use `transfer: 'none'` for a soulbound item.

## Mint and transfer

```ts
await game.items.mint(sword.id, playerAddress)
await kei.items.transfer(sword.id, recipientAddress)
```

The issuer mints. The current owner signs a transfer.

## Query ownership

```ts
await kei.items.owner(sword.id)
await kei.items.ownedBy(playerAddress)
```

Ownership is part of ledger state and can be queried directly; no separate inventory indexer is required.

## Keep live game state elsewhere

Put durable ownership on the ledger. Keep rapidly changing state such as durability ticks, live stack counts, position, or cooldowns in the game system that owns the real-time loop.
