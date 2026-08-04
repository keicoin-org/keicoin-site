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

## These are references the harness plans with, not templates you pick

**Create Kei MMO asks no template question**, and this is the part of its design
most often mistaken for the opposite. You describe the MMO you want and choose
2D, 3D, or auto. Whether any reference codebase is worth starting from — and
which one, and whether to adopt it whole or draw on it for a single system — is
the harness's own planning problem, decided from your description and *reported*
in `kei-mmo/plan.json` rather than asked.

The three examples on this page are among the candidates it scores. Starting
blank is a normal outcome, not a fallback.

::: danger Create Kei MMO does not produce a working game yet
This is a draft, and a long way from its own headline. Its repository's default
branch still carries a **retired three-template scaffolder**; the current work is
an unpublished branch behind
[PR #1](https://github.com/keicoin-org/create-kei-game/pull/1), where the harness
resolves an intent, plans it, prepares the project, and then runs **one bounded
engine pass over the first step of that plan** — a real provider call, three
workspace-scoped tools, at most 24 model round-trips and thirty minutes — and
stops.

Measured against the [eight criteria on the status
page](https://keicoin.org/status), only the first partly holds. The result does
not install, build, run, or put two players in a world together. There is no Kei
terminal UI, no session past that one pass, and no package published under either
name. **If you want a running Kei MMO today, fork World of Wonder** — that is a
real one.
:::

### See what it would decide, before it decides anything

`--plan-only` needs no provider, no credential, and touches no directory. It is
the honest thing to run first, because it shows you what is deferred before
anything is written.

```sh
git clone -b codex/m9-game-harness https://github.com/keicoin-org/create-kei-game
cd create-kei-game && bun install

bun run src/index.ts -- "Salvage Run" --3d \
  --gameplay "Crews salvage derelict stations and haul cargo home." \
  --plan-only
```

It prints the engine decision and its reasons, every reference candidate with its
score, the capability packets selected and deferred, the constraints, the
acceptance criteria, and the build order. A plan may only cite a capability
marked available; anything it cannot do appears as an explicit deferral rather
than being quietly dropped.

### Agent mode never prompts

An AI caller supplies every input explicitly and gets one JSON value back. The
credential is passed as the **name of an environment variable**, never as a
value — that variable has to already hold a key, and the harness reads only the
name, checks the value is present, and refuses the run if it is not.

```sh
bun run src/index.ts -- "Salvage Run" --agent --json --3d \
  --gameplay "Crews salvage derelict stations and haul cargo home." \
  --provider openai --model provider-model-id \
  --api-key-env OPENAI_API_KEY --no-launch
```

`--gameplay` and a dimension are **required in agent mode and never inferred**;
`--dimension auto` is a legitimate explicit answer, an omitted one is not.
`--agent` is deliberately incompatible with `--yes`, which only takes human
onboarding defaults. Run `bun run src/index.ts -- --help` in the checkout for the
authoritative option list.

::: warning `--source` and `--template` are retired, and refused
They are not ignored — they exit with a sentence saying where the decision went.
A flag that silently does nothing is worse than one that is gone, and earlier
versions of *this page* printed a `--source template --template button` command
that the harness now rejects.
:::

::: warning The npm package is a different, retired product
`create-kei-game@0.2.0` on npm is the superseded scaffolder published from
`kei-transaction`. It is not this harness, and there is no `create-kei-mmo`
package on npm. Run the checkout with Bun, as above.
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
- **Carpet Markets is not mainnet-ready, and cannot become mainnet-ready.** Mainnet is not a build task — validator distribution, reserve governance and a legal conversation gate it, and nothing shipped in a demo moves any of them. A launchpad is also the worst possible first thing to put on a real network, which is the whole reason this one is safe to show you. Read `lib/market.ts` for the API; do not copy the interface around it.
- World of Wonder's hosted copy runs a process-local mock chain, so nothing on it survives a restart. The repository settles on the public testnet by default.

## What is not finished in each

Named here as well as on each page, because a reader choosing one of these to fork deserves to find the gap before they are inside it.

| | Done | Not done |
| --- | --- | --- |
| [Button](./button.md) | The balance on the pole is the chain's, with unbanked earnings shown separately beside it. Spending is graded against confirmed, available funds. | Presses are still counted by the client. It is single-player; nothing else can see them. |
| [Carpet Markets](./carpet-markets.md) | The argument, and its proof: every claim the badge makes is asserted at the ledger, the price is the last thing two people agreed on, and a card leads with the transfer policy and the creator's remaining share rather than a market cap. | **The interface around the argument.** Assessed against the pump-style launchpads it is modelled on it is materially weaker, and seven of its [nine written criteria](https://keicoin.org/status) are unmet: a first buy takes too many steps, refusing states surface as failures rather than being named beforehand, it is unusable at 360 px, it is not keyboard-completable, and its known holes live in the README rather than on the screen where they bite. |
| [World of Wonder](./world-of-wonder.md) | The auction house's **screen and mechanism**: Browse, Sell and Mine over player-signed offers, with both legs settling in one block and an end-to-end test that says so. | Equipping, loot and quest rewards still run on upstream's inventory tables, and the trainer still spends `player_data.gold`. The hall's in-memory roster is bounded and incomplete by design. |

## Continue

- [Button](./button.md) — a 3D clicker with a real economy.
- [Carpet Markets](./carpet-markets.md) — a launchpad with a real peer-to-peer order book.
- [World of Wonder](./world-of-wonder.md) — a multiplayer RPG whose gold is not in its database.
- [Integration model](../guide/integration.md) — the two halves every one of these is built from.
- [Project status](https://keicoin.org/status) — what works today, and what is scheduled rather than shipped.
