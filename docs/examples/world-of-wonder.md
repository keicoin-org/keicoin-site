---
title: World of Wonder
description: A multiplayer Babylon.js and Colyseus RPG whose gold and items are chain assets instead of database rows.
---

# World of Wonder

A multiplayer 3D top-down RPG whose **gold and items live on a chain instead of in the game's database**. Fork it, rename it, and you have an MMO where a player's sword is theirs rather than a row you could delete.

It is a fork of [`orion3dgames/t5c`](https://github.com/orion3dgames/t5c) — a real Babylon.js and Colyseus RPG with movement, combat, quests, loot, a navmesh, a vendor and a UI. All of that is upstream's work and still upstream's. What the fork replaces is the economy.

[Play it](https://mmo.keicoin.org), or read [the source](https://github.com/keicoin-org/world-of-wonder). **This is the example to start from if you are building something rather than reading something.**

![World of Wonder gameplay view with character, village, combat hotbar, chat, and HUD](/img/docs/world-of-wonder-gameplay.webp)

*Gameplay screenshot from the maintained World of Wonder repository. It shows the world and HUD, not the Auction House.*

## One task, end to end

This page is the tour. If you came for one piece of it:

- [Auction house integration](./world-of-wonder/auction-house.md) — put a player-to-player auction house in your own fork: the wallet calls that list, buy and cancel, the two routes the server answers, and the check that has to be there before an accept is signed.
- [Loot and drops](./world-of-wonder/loot-and-drops.md) — why phase one now refuses rewards rather than writing a second inventory, what is already implemented behind that refusal, and the wallet-proof boundary still blocking it.

| | |
| --- | --- |
| Client | Babylon.js, webpack |
| Server | Node 20.17+, Colyseus, SQLite or MySQL |
| Database | Accounts, characters, positions. Never money. |
| Default chain | The public testnet |
| Every line of Kei in the client | `src/client/Controllers/Wallet.ts` |

## Run it

**Terminal 1 — server:**

```sh
git clone https://github.com/keicoin-org/world-of-wonder
cd world-of-wonder
npm ci
KEI_NETWORK=mock npm run server-build && KEI_NETWORK=mock npm run server-start
```

**Terminal 2 — client:**

```sh
cd world-of-wonder
npm run client-dev                              # http://localhost:8080
```

The released `kei-transaction` SDK is a normal npm dependency. A clean clone does not need a sibling checkout or a link step.

::: warning It settles on the public testnet by default
That default is deliberate: a player's wallet is meant to outlive your server, and it cannot do that against a chain living inside it. The testnet is best-effort, has weak consensus, no uptime promise, and Kei that is worth nothing. Every persistent node, including the default testnet, requires a fixed `KEI_GAME_SEED`; startup refuses a missing or invalid one before touching the database or chain. The run command above uses `KEI_NETWORK=mock`, the only mode allowed to generate an ephemeral issuer, for a no-secret local start.
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
| Loot, quest rewards, equipping | Database rows are authority | Legacy rows are inert; gameplay asks the chain authority and currently refuses because wallet proof is unavailable |

## There is one inventory, and phase one is a refusal

The default branch no longer loads `character_inventory`, `character_equipment`, or `player_data.gold` into gameplay. It reads those legacy rows once on join only to tell the player that they exist and are inert; autosave does not rewrite them. A row inserted directly into SQLite authorizes nothing.

`src/server/kei/Inventory.ts` is now the one place gameplay may ask what a character holds. It is designed to bind a character to an address through a server-issued, domain-separated, single-use challenge, then re-read chain holdings before an equip or consume and mint a server-authored reward once. The repository's server wiring uses `proofUnavailable`, because the SDK has no ownership-challenge signing helper yet. Therefore a fresh character has no usable inventory or gold, and equipping, consuming, dropping, pickups, and kill or quest payouts refuse out loud instead of falling back to database custody.

That is [phase one of the migration](https://github.com/keicoin-org/world-of-wonder/pull/8), not the finished feature. `npm run test:inventory` proves the dormant boundary with a stub verifier: forged and reused challenges fail, a database sword authorizes nothing, a chain-held sword does, listing it locks it out of gameplay, and one reward id pays once across repeated messages and a fresh authority reading the same payment records.

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

## The auction house is a screen over player chains

The Auction House panel has three views: Browse for offers from other players, Sell for choosing an item, quantity and asking price, and Mine for taking back your own open offers. `src/server/kei/Market.test.ts` holds the proof underneath it: one player lists a sword bought from the shop, another buys it, and the gold and the sword move in one settlement with the game server taking no part in it. The test also pins the part that is easy to get wrong later — a listed item cannot also be handed to somebody, and the ledger is what refuses it.

::: warning It is `market.offer()`, not `market.sell()`
`sell()` prices things in Kei. Gold is not Kei — it is an asset this world issues — so a listing is an item on one side and gold on the other. Writing it the other way compiles and quietly denominates the auction house in a currency the game does not use.
:::

Know the limit before designing around it — an offer lives on its author's chain and Kei ships no indexer, so there is no query for *every listing in the world*. This hall keeps a bounded, in-memory roster of accounts it has heard from and walks those chains. A restart empties the roster until wallets return; an unheard-of seller is invisible without ever losing custody of the listed item. That is bookkeeping about where to look rather than about who owns what. [Carpet Markets](./carpet-markets.md) does the same job in its registry.

Nothing the hall reports is trusted at signing time. The wallet re-reads the offer by hash and binds its seller, item asset, quantity, quote asset and price to what was displayed before accepting it. Names come from the client's local catalogue, so a dishonest hall can hide or advertise a dead offer, but cannot substitute another item.

A database-backed auction house instead would look identical to a player and mean the opposite thing, since this server can already mint gold.

## Where things are

```
src/server/kei/Economy.ts                                the issuer: gold, items, the shop. Read this one.
src/server/kei/Inventory.ts                              the sole gameplay ownership and reward authority
src/server/kei/Legacy.ts                                 reads old economy rows only to report that they are inert
src/server/kei/api.ts                                    the HTTP surface. Nothing here can move a player's money.
src/server/kei/node.ts                                   which chain, and which account issues the money
src/server/kei/Economy.test.ts                           the rules, against a chain in-process
src/server/kei/Inventory.test.ts                         proof, chain ownership, refusal, and reward idempotency
src/server/kei/Hall.ts                                   the bounded roster and chain walk behind Browse
src/server/kei/Market.test.ts                            listing, acceptance, cancellation, history and trust-boundary checks
src/server/kei/endtoend.test.ts                          the same thing across a URL, the way a browser does it
src/client/Controllers/Wallet.ts                         the player's key, and the only thing that spends their gold
src/client/Controllers/UI/Panels/Panel_Auction.ts        Browse, Sell and Mine, as a player sees them
src/client/Controllers/UI/Panels/Dialog/VendorDialog.ts  the shop, as a player sees it
src/client/Utils/index.ts                                where the client looks for the server
```

## Configuration

Copy `.env.example` to `.env`. A real environment variable always wins over a line in that file.

| Variable | Default | Effect |
| --- | --- | --- |
| `KEI_GAME_SEED` | required on persistent nodes | **This is the economy.** Whoever holds it can mint this world's currency without limit. Testnet, mainnet, and every custom `KEI_NODE` refuse to start without one fixed 64-hex seed. Only an in-process `KEI_NETWORK=mock` may generate an ephemeral seed. |
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
npm run test:inventory  # the phase-one ownership/refusal boundary
npm test                # startup, economy, market, and inventory
KEI_NETWORK=mock npm run server-start &
npm run test:e2e        # the same thing over HTTP, sharing no memory with the server
```

`test:e2e` signs its own transfers against `/rpc` and waits for the item to arrive, so it is the auction-house proof across the browser-facing boundary. `test:inventory` owns the newer gameplay boundary; it is deterministic against a `MockNode` and temporary SQLite database because the production verifier is intentionally unavailable.

## Known limits

- **The hall is deliberately incomplete.** It only reads the bounded set of player chains this server has heard from, and that roster is in memory. A restart empties it until wallets announce themselves again; Kei ships no global offer index.
- **Wallet proof is not built, so phase one refuses gameplay economy actions.** Legacy inventory, equipment, and gold rows are inert. The chain-backed authorization and idempotent mint paths are implemented and tested with a stub verifier, but the running server uses `proofUnavailable`; equipping, consuming, dropping, pickups, and gold or item rewards do not work today.
- The [hosted copy](https://mmo.keicoin.org) is live, not production-ready: it runs a process-local mock chain, so nothing on it survives a restart. The repository settles on the public testnet by default.
- Consensus is weak until the validator set is distributed. Until then this is a testnet with branding, and not somewhere to put real value.
- Per-instance mutable item state — durability ticking every second, live stack counts — is not what an asset is for. Model the archetype on-chain and keep that state local.
- Upstream's `nanoid` advisory chain is documented in the repository README, including why the obvious `overrides` fix breaks the server.

## Continue

- [Integration model](../guide/integration.md) — the two halves, without a game around them.
- [Security rules](../guide/security.md) — the constraints this fork is built to satisfy.
- [Items reference](../reference/items.md) — the API behind the inventory.
