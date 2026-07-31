---
title: Batch rewards
description: Commit large reward batches and let players claim them independently.
---

# Batch rewards

Do not mint once per player when distributing a large reward batch. One account has one chain, so sequential issuer mints become the bottleneck.

## Commit once on the issuer

```ts
const drop = await gems.commit([
  { to: playerA, amount: 500 },
  { to: playerB, amount: 250 },
])

const bundle = drop.proofFor(playerA)
```

The issuer publishes one commitment, however many recipients are in the batch. Deliver each recipient's proof bundle through your existing game service.

## Claim from the player wallet

```ts
await kei.claims.add(bundle)
```

The player publishes their own claim. Claims can land independently and in parallel.

The ledger rejects:

- a forged proof;
- a changed amount;
- a claim for another account;
- a second claim from the same account.

## Close old commitments

```ts
await gems.close(drop.root)
```

Close a commitment according to the game's published reward policy after its claim period has ended.
