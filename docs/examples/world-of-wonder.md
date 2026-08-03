---
title: World of Wonder
description: A multiplayer Babylon.js and Colyseus RPG whose gold and items are chain assets instead of database rows.
---

# World of Wonder

A multiplayer 3D top-down RPG whose **gold and items live on a chain instead of in the game's database**. Fork it, rename it, and you have an MMO where a player's sword is theirs rather than a row you could delete.

It is a fork of [`orion3dgames/t5c`](https://github.com/orion3dgames/t5c) — a real Babylon.js and Colyseus RPG with movement, combat, quests, loot, a navmesh, a vendor and a UI. All of that is upstream's work and still upstream's. What the fork replaces is the economy.

[Play it](https://mmo.keicoin.org), or read [the source](https://github.com/keicoin-org/world-of-wonder). **This is the example to start from if you are building something rather than reading something.**

| | |
| --- | --- |
| Client | Babylon.js, webpack |
| Server | Node 20.17+, Colyseus, SQLite or MySQL |
| Database | Accounts, characters, positions. Never money. |
| Default chain | The public M3 testnet |
| Every line of Kei in the client | `src/client/Controllers/Wallet.ts` |

## Run it

```sh
git clone https://github.com/keicoin-org/world-of-wonder
cd world-of-wonder
npm ci
cp .env.example .env                            # optional — everything has a default
npm run server-build && npm run server-start    # http://localhost:3000
npm run client-dev                              # http://localhost:8080
```

The released `kei-transaction` SDK is a normal npm dependency. A clean clone does not need a sibling checkout or a link step.

::: warning It settles on the public testnet by default
That default is deliberate: a player's wallet is meant to outlive your server, and it cannot do that against a chain living inside it. The testnet is best-effort, has weak consensus, no uptime promise, and Kei that is worth nothing. `KEI_NETWORK=mock` gives you the in-process chain instead, which is right offline.
:::

## What changed from upstream

t5c kept `gold` as a `uint32` on `PlayerSchema` and inventory in a `character_inventory` table. That is the ordinary way to build this, and it means the developer owns every player's belongings — "you own this item" is then a promise about your intentions, not a fact about the world.

| | Upstream | Here |
| --- | --- | --- |
| Gold | `PlayerSchema.gold`, saved to SQLite | A Kei token. `balanceOf` is the only source of truth. |
| Inventory | `character_inventory` rows | One 0-decimal asset per item archetype; owning a sword is holding a unit of it. |
| Buying | Server decrements gold, adds a row | Player signs a transfer; the issuer mints **after** the chain confirms it |
| Selling | Server increments gold | Player signs the item away; the shop pays for what arrived |
| The vendor panel | Sends a room message | Signs with the player's wallet, and reads the purse off the chain |
| The bag panel | Reads `PlayerSchema.inventory` | Refreshes the player's on-chain item balances and purse |

## The database is still there, deliberately

It holds accounts, characters, and where they were standing. Colyseus is still authoritative over presence and position. Neither is authoritative over money, which is the whole point.

| Concern | Where it belongs |
| --- | --- |
| Position, presence, combat, rooms | Colyseus |
| Accounts, characters, where they logged out | The database |
| What a quest pays, what a sword costs | The server — this is design, not custody |
| Balances, ownership, transfers | The chain. Always. |

A chain is not a low-latency datastore. Nothing on the critical path of the 60 Hz loop touches it.

## The wallet is the browser's

`Kei.start()` generates the player's seed on first run and keeps it in localStorage, so there is no signup and no account to create — and clearing site data loses the wallet, which is the other half of owning it.

The game never holds that key. That is why the vendor panel signs its own payments and reads the purse off the chain instead of trusting a number the room sent it.

## Buying takes two signatures

The game cannot sign for a player's wallet, so a purchase is always the player signing a transfer and the issuer signing a delivery. A transfer carries no memo, so the shop records the order first and matches the arrival to it — and delivers nothing until the chain says the gold landed.

**The order is not the purchase.** `src/server/kei/Economy.test.ts` holds the code to that: an unpaid order delivers nothing, and a player who cannot afford something is refused in a sentence they can act on.

## Selling takes one, and there is no route for it

A sale is the player transferring the item to the shop, and the shop paying for what arrived.

There is deliberately no `POST /kei/sell`. The server can mint this world's currency, so any endpoint that paid on request would be a printing press for whoever found it. Reacting to an arrival costs the seller the item first, which is the only version of this a stranger cannot exploit. What the shop pays is in the catalogue, so a client can still quote a price without asking.

::: tip The general rule
Any server endpoint that pays out on request, rather than in reaction to something already settled on the chain, is a printing press. Make the player's side of the trade happen first, and react to it.
:::

## Where things are

```
src/server/kei/Economy.ts                                the issuer: gold, items, the shop. Read this one.
src/server/kei/api.ts                                    the HTTP surface. Nothing here can move a player's money.
src/server/kei/node.ts                                   which chain, and which account issues the money
src/server/kei/Economy.test.ts                           the rules, against a chain in-process
src/server/kei/endtoend.test.ts                          the same thing across a URL, the way a browser does it
src/client/Controllers/Wallet.ts                         the player's key, and the only thing that spends their gold
src/client/Controllers/UI/Panels/Dialog/VendorDialog.ts  the shop, as a player sees it
src/client/Utils/index.ts                                where the client looks for the server
```

## Configuration

Copy `.env.example` to `.env`. A real environment variable always wins over a line in that file.

| Variable | Default | Effect |
| --- | --- | --- |
| `KEI_GAME_SEED` | generated per run | **This is the economy.** Whoever holds it can mint this world's currency without limit. Unset, a new issuer means new asset ids, so every balance and item from the previous run becomes unreachable. |
| `KEI_NETWORK` | `testnet` | `testnet`, `mainnet`, or `mock`. Selecting `mainnet` without a `KEI_NODE` stops the server with an explanation rather than settling somewhere else. |
| `KEI_NODE` | — | Override the node URL for whichever network is selected. |
| `KEI_EXCHANGE` | on | `off` disables paying Kei for gold. The game stays playable. |
| `DATABASE_PATH` | `./database.db` | SQLite file. The engine itself is `database` in `src/shared/Config.ts`, not an environment variable. |
| `NODE_ENV` | `development` | `production` closes `/kei/grant`, never loads the Colyseus monitor, and turns off the 250 ms latency simulation. |
| `GAME_SERVER` | page origin | Where the built client looks for the game server. Read at **build** time and compiled into the bundle. |
| `KEI_TEST_BASE` | `http://localhost:3000` | Base URL for `npm run test:e2e`. |

::: danger Generate a seed per deployment
```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Keep it out of the repository, out of logs, and out of the client. `mainnet` has no faucet, so this world's issuer address has to be funded by a person before the first run.
:::

## Tests

```sh
npm run test:economy    # the rules, in-process
npm run server-start &
npm run test:e2e        # the same thing over HTTP, sharing no memory with the server
```

`test:e2e` is the one worth trusting. It signs its own transfers against `/rpc` and waits for the item to arrive, so passing it means a hosted client can work rather than suggesting it might.

## Known limits

- The [hosted copy](https://mmo.keicoin.org) is live, not production-ready: it runs a process-local mock chain, so nothing on it survives a restart. The repository settles on the public testnet by default.
- Consensus is weak until the validator set is distributed. Until then this is a testnet with branding, and not somewhere to put real value.
- Per-instance mutable item state — durability ticking every second, live stack counts — is not what an asset is for. Model the archetype on-chain and keep that state local.
- Upstream's `nanoid` advisory chain is documented in the repository README, including why the obvious `overrides` fix breaks the server.

## Continue

- [Integration model](../guide/integration.md) — the two halves, without a game around them.
- [Security rules](../guide/security.md) — the constraints this fork is built to satisfy.
- [Items reference](../reference/items.md) — the API behind the inventory.
