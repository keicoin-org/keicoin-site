---
title: Examples
description: Three games built on the Kei SDK, each making a different argument for putting a game economy on a chain.
---

# Examples

Three games, each one making a different argument for putting an economy on a chain. All of them run, all of them are readable, and none of them hold value.

They are ordered by how much they ask of you. **Button** is the SDK in one tab. **Carpet Markets** is what happens when players can issue things and trade them with each other. **World of Wonder** is a real game with the economy replaced, and the one to fork if you are shipping something.

## Which one to read

| | [Button](./button.md) | [Carpet Markets](./carpet-markets.md) | [World of Wonder](./world-of-wonder.md) |
| --- | --- | --- | --- |
| The argument | Every SDK primitive in one legible loop | A market is consensus, not a service you operate | An existing game keeps its database and loses its ledger |
| Read it to learn | `commit` / `claim`, and the two-signature purchase | `@keicoin/market`, and what `transfer` policy actually enforces | How to retrofit an economy without rewriting a game |
| Client | Babylon.js | Next.js, static export | Babylon.js + Colyseus |
| Server | One Bun process | One Bun process | Node, Colyseus, SQLite or MySQL |
| Database | None | None | Accounts, characters, positions — never money |
| Default chain | In-process mock | In-process mock | The public testnet |
| Lines of Kei in the client | `src/economy.ts`, ~200 | `lib/market.ts` | `src/client/Controllers/Wallet.ts` |
| Play it | [/examples/button](https://keicoin.org/examples/button) | [/examples/carpet-markets](https://keicoin.org/examples/carpet-markets) | [mmo.keicoin.org](https://mmo.keicoin.org) |
| Source | [keicoin-org/button](https://github.com/keicoin-org/button) | [keicoin-org/carpet-markets](https://github.com/keicoin-org/carpet-markets) | [keicoin-org/world-of-wonder](https://github.com/keicoin-org/world-of-wonder) |

## Which primitives each one exercises

A blank cell is not a gap in the SDK. It is a primitive that example had no honest reason to use.

| Primitive | Button | Carpet Markets | World of Wonder |
| --- | --- | --- | --- |
| `Kei.start()` — player wallet | ✅ | ✅ | ✅ |
| `Kei.server()` — issuer | ✅ | ✅ (one account per coin) | ✅ |
| `token.issue` | ✅ | ✅ | ✅ |
| `mint` / `burn` | ✅ | ✅ | ✅ |
| `transfer` | ✅ | | ✅ |
| `pay` / `onPayment` | ✅ (exchange desk) | ✅ (launch fee) | ✅ (exchange desk) |
| `items.create` / `items.mint` | ✅ | | ✅ |
| `commit` / `claims.add` | ✅ | | |
| `market.sell` / `accept` / `cancel` | | ✅ | ✅ (`market.offer`, Browse / Sell / Mine) |
| `market.price` / `trades` | | ✅ | |
| `wallet.summary` | ✅ | ✅ | ✅ |
| `faucet` | ✅ | ✅ | ✅ |

## Start from one instead of cloning it

Each example is a template the scaffolder writes for you, renamed and with your own currency already in it:

```sh
npm create kei-game my-game                                    # star-clicker, the default
npm create kei-game my-mmo -- --template world-of-wonder
npm create kei-game my-launchpad -- --template carpet-markets
```

Cloning the repository directly gets you the same files under the original name.

::: info The three templates are published
`create-kei-game@0.2.0` scaffolds Button, Carpet Markets, or World of Wonder. Cloning a repository directly remains useful when you want the complete worked application rather than a starting template.
:::

## What all three have in common

Three properties are deliberate in every one of them, and they are the properties worth copying:

- **No balances table.** Not one of these games stores a balance, an inventory row, or a holdings record. `balanceOf` and `ownedBy` are the only source of truth, and every one of these servers can be stopped and restarted without a player losing anything.
- **The server never signs for a player.** A purchase is two signed transactions — the player signs the payment, the issuer signs the delivery — because a game cannot sign for a player's wallet and there is no API pretending otherwise. See the [security rules](../guide/security.md).
- **What the server does own is design, not custody.** What a press is worth, what a sword costs, which coins exist. Those are opinions a chain has no business holding.

## What none of them are

::: danger Nothing here holds value
That is a design constraint rather than a disclaimer. There is no mainnet, and the hosted copies run against mock chains that reset when the process or the Durable Object holding them goes away. They are demos, not services.
:::

- Button counts its own presses, because in single-player nothing else can see them. That is a real trust hole with a ceiling on it, written down in the source rather than hidden.
- Carpet Markets has one open quote per address, because a Kei transfer carries no memo and an arriving payment says only who sent it and how much. Two browser tabs racing is a thing you can do to yourself.
- Carpet Markets is a satire of a real pattern that has taken real money from real people. It is worth playing precisely because the coins are worthless; it is not worth copying anywhere they are not.
- World of Wonder's hosted copy runs a process-local mock chain, so nothing on it survives a restart. The repository settles on the public testnet by default.

## What is not finished in each

Named here as well as on each page, because a reader choosing one of these to fork deserves to find the gap before they are inside it.

| | Done | Not done |
| --- | --- | --- |
| [Button](./button.md) | The balance on the pole is the chain's, with unbanked earnings shown separately beside it. Spending is graded against confirmed, available funds. | Presses are still counted by the client. It is single-player; nothing else can see them. |
| [Carpet Markets](./carpet-markets.md) | The client is a Next.js static export, and a card leads with the transfer policy and the creator's remaining share rather than a market cap. | The book is only as complete as the registry's account list, and the replies are the one piece of state here that is not a block. |
| [World of Wonder](./world-of-wonder.md) | The auction house's **screen and mechanism**: Browse, Sell and Mine over player-signed offers, with both legs settling in one block and an end-to-end test that says so. | Equipping, loot and quest rewards still run on upstream's inventory tables, and the trainer still spends `player_data.gold`. The hall's in-memory roster is bounded and incomplete by design. |

## Continue

- [Button](./button.md) — a 3D clicker with a real economy.
- [Carpet Markets](./carpet-markets.md) — a launchpad with a real peer-to-peer order book.
- [World of Wonder](./world-of-wonder.md) — a multiplayer RPG whose gold is not in its database.
- [Integration model](../guide/integration.md) — the two halves every one of these is built from.
- [Project status](https://keicoin.org/status) — what works today, and what is scheduled rather than shipped.
