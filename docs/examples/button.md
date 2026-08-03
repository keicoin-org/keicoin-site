---
title: Button
description: A 3D clicker that exercises every Kei primitive — issue, commit, claim, transfer, mint, items — with no database and no save file.
---

# Button

A green button on a pole. Press it, get coins, buy something that presses better.

It is deliberately a clicker: the loop is legible in three seconds, and it exercises every primitive in the SDK without anybody having to invent a reason. [Play it](https://keicoin.org/examples/button), or read [the source](https://github.com/keicoin-org/button).

![Local Button game showing the green button, reward counter, NPC shop board, shopkeeper, and targets](/img/docs/button-gameplay.png)

*Local Button app at localhost:7777. The center board exposes press rewards and clearing; the left board is the implemented shop.*

For the money loop on its own — press, bank, commit, claim, as a script you can run — start with [Button fundamentals](./button/fundamentals.md).

| | |
| --- | --- |
| Client | Babylon.js, one bundle, no framework |
| Server | One Bun process — the mock node, the game API, and the static client |
| Database | None. No `users`, no `balances`, no `inventory`, no save file |
| Chain | In-memory mock, served over HTTP by the same process |
| Every line of Kei in the client | `src/economy.ts`, about two hundred lines including comments |

## Run it

```sh
git clone https://github.com/keicoin-org/button
cd button
bun install
bun run dev          # http://localhost:7777
```

The server generates an issuer seed per run unless `KEI_GAME_SEED` is set. A new issuer means new asset ids, which is fine here because the ledger is new too.

## The loop

| | |
| --- | --- |
| **Press** | Click the button, or hit space. Presses accumulate unbanked. |
| **Bank** | Every 20 presses (or 3 seconds) the client asks the server to pay for them. The server adds you to the next batch. |
| **Claim** | The batch becomes **one** `commit` block; you get a proof and your own wallet writes the claim. |
| **Buy** | Click a row on the shop board. You transfer coins; the shopkeeper mints the item and burns the coins. |
| **Exchange** | Optional. Pay Kei, get coins at the posted rate. Turn it off and the game is unchanged. |

## Every primitive, and where it shows up

| Primitive | Where |
| --- | --- |
| `token.issue` | The game creates its coin on startup, idempotently, in `server/game.ts` |
| `items.create` | One asset per upgrade archetype, with a real supply cap |
| `commit` / `claims.add` | Banked presses become one issuer block; your wallet writes the claim |
| `transfer` | You pay the shopkeeper in coins, signed by you |
| `items.mint` | The shopkeeper delivers the upgrade — only once the chain says the coins landed |
| `burn` | The coins you spent are destroyed rather than pooled |
| `balanceOf` | The screen on the pole, and the price check in the shop |
| `wallet.summary` | Restores every upgrade you own on page load; this is the save file |
| `pay` / `onPayment` | The optional exchange desk: Kei in, coins out |
| `faucet` | Tops the player up on a non-mainnet network so the desk is usable |

## Why banking instead of minting

Minting per press would put every player's reward on the issuer's chain, and one account has one chain — so the issuer becomes a global write lock and the queue behind it becomes the game.

Presses are batched instead. Every player who banked in the same window ends up in **one issuer block**, and each of them then writes their own claim, from their own account, in parallel, with no contention.

```ts
// server/game.ts — the issuer, once per window, however many players banked
const drop = await this.coins.commit(batch.map(([to, amount]) => ({ to, amount })))
for (const [address] of batch) {
  const bundle = drop.proofFor(address)   // plain JSON; hand it over however you like
  // ...resolve the waiting HTTP request with it
}
```

```ts
// src/economy.ts — the player. From here the game is not involved.
const body = await fetch(at('/game/bank'), { /* address, presses */ }).then(r => r.json())
await kei.claims.add(body.bundle)
```

The batcher merges per address on purpose: a root commits to at most one entitlement per account, so two banks inside one window are one leaf, not two.

With one player it is a batch of one and the code is identical. That is the property that matters — this does not need rewriting when there are a thousand. See the [batch rewards reference](../reference/claims.md).

## Why buying takes two signatures

The game cannot sign for a player's wallet, so a purchase is always the player signing a transfer and the issuer signing a delivery. A transfer carries no memo, so the shop takes the order first and matches the arrival to it — and delivers nothing until the chain says the coins landed.

```ts
// src/economy.ts
const order = await fetch(at('/game/order'), { /* address, sku */ }).then(r => r.json())
await coins.transfer(order.to, order.price)
// The shop signs the delivery. There is no third arrangement in which one of
// them signs for the other.
```

**The order is not the purchase.** The order records intent; the arriving transfer is the fact. The server reconciles the two, and an unpaid order delivers nothing.

For the whole shopkeeper protocol — the quote, the verification, the mint, the burn, and what is still missing — see [the NPC shop guide](./button/npc-shop.md).

## What a player is allowed to spend

The balance on the pole is the chain's figure and nothing is added to it. What a press has earned and not been paid for is a second, amber number beside it — presses still unbanked, plus whatever is in flight — and it is never part of the balance.

That split is the point rather than a nicety. The screen used to draw `coins + pendingCoins`, so the biggest number in a game whose whole argument is *there is no number that is not on the chain* was the one number that was not. It also disagreed with the shop board two metres away, which grades affordability off the confirmed balance: a player could read 40, click a 25-coin upgrade, and be told they have 20 — which reads as the chain being broken when it was the client guessing.

**Spending is graded against confirmed, available funds.** The pending figure drains as real confirmations arrive rather than when banking starts, so it does not blink to zero mid-batch, and it drains by what the bundle actually paid — the server caps a bank that arrived too fast to be a human hand, so the presses asked for and the coins paid are not always the same figure.

## Where things are

```
shared/catalogue.ts   what a press is worth and what upgrades cost — used by both halves
server/game.ts        the issuer: token, items, the batcher, the shop. The whole backend.
server/main.ts        one Bun server: the mock node at /rpc, the game at /game/*, the client at /
src/economy.ts        every line of Kei in the client
src/world.ts          Babylon: the button, the screen, the shopkeeper
src/screen.ts         what the two in-world screens draw
```

Read `src/economy.ts` to learn the SDK. Read `server/game.ts` to learn what a game server still has to do once it is not allowed to hold money.

`shared/catalogue.ts` is shared by both halves deliberately. The server is authoritative about payouts because it is the only side that can mint, but the client has to predict the same numbers to draw them, and two copies of that arithmetic would drift within an afternoon. Nothing in it is a balance — it is a price list.

## No database, and what that buys

There is no persistent storage of any kind on the game server. Stop it, start it, and a player's coins and upgrades are still theirs, because they were never the server's to hold.

On load the client calls `kei.wallet.summary()` and rebuilds the player's upgrades from their on-chain item balances. There is no save file to corrupt, migrate, or lose.

What the server does own is what a game server *should* own: what a press is worth, and what things cost.

## Configuration

| Variable | Default | Effect |
| --- | --- | --- |
| `PORT` | `7777` | Listen port |
| `KEI_GAME_SEED` | generated per run | The issuer seed. Fixing it keeps asset ids stable across restarts. |
| `BUTTON_EXCHANGE` | on | `off` removes the exchange desk from the shop |

## Playing with payments off

The game has to be enjoyable with payments disabled, so that is a switch rather than a claim:

```sh
BUTTON_EXCHANGE=off bun run dev
```

The exchange desk disappears and Kei buys nothing. Everything else — pressing, banking, claiming, buying upgrades with coins — is untouched, because coins come from playing and never from paying.

With no server running at all, the page still loads and the button still presses; it says on the screen that nothing is being banked.

## Tests

```sh
bun test
```

`test/economy.test.ts` runs the loop against a chain in-process. `test/m4-native.test.ts` runs the commit and claim path against a native node, which is what makes "the batching works" a checked statement rather than a description.

## Known limits

::: warning The client counts its own presses
In single-player nothing else can see them. There is a rate ceiling, so the hole is worth a few coins rather than the supply — that is all it is, and it is written down in the source rather than hidden. Presses become observed once there is a server watching them.
:::

- The chain underneath is a mock. It dies when you stop the server, and nothing on it is worth anything. `test/m4-native.test.ts` is what connects this to a real node; the game itself does not.
- The issuer seed is generated per run unless `KEI_GAME_SEED` is set.
- The pending figure is the client's own arithmetic until a bundle confirms it. It is shown as what is owed, never as what is held, and nothing in the game will let a player spend it.

## Continue

- [Button fundamentals](./button/fundamentals.md) — the same loop as a runnable script: two seeds, one commit, one claim, no Babylon.
- [Button NPC shop](./button/npc-shop.md) — the purchase protocol: order, transfer, on-chain verification, mint, burn.
- [Player rewards](./button/player-rewards.md) — presses and mob drops as recipient-bound claims: batching, retries, serialized claiming, and the gaps.
- [Carpet Markets](./carpet-markets.md) — what happens when players can issue things and trade them with each other.
- [Batch rewards reference](../reference/claims.md) — the `commit` and `claim` API this example is built around.
- [Integration model](../guide/integration.md) — the two halves, stated once, without a game around them.
