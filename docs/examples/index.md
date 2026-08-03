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

## Use one as a harness source

Create Kei Game is becoming an ongoing game-building harness, not another game
template. During onboarding, a project can start blank, from one of these three
examples, from an existing local project, or from an HTTPS GitHub or GitLab
repository. Choosing an example clones its real repository; the harness does
not hide a second bundled copy that can drift away from it.

The standalone harness is still an unpublished development draft. From its
[repository checkout](https://github.com/keicoin-org/create-kei-game), human
onboarding starts with:

```sh
bun run src/index.ts --
```

It asks for the project name, the source, then the provider, the exact model
ID, the name of the environment variable holding your provider key, any
transport detail that provider needs, and the game brief. The variable it is
told about has to already hold a key: the harness reads only the name, checks
that the value is present, and refuses the run if it is not.

An AI caller reaches the same validated project plan through the hard no-prompt
agent boundary. With that environment variable already set:

```sh
bun run src/index.ts -- "My Button Game" --agent --json \
  --source template --template button \
  --provider openai --model provider-model-id \
  --api-key-env OPENAI_API_KEY --brief "Build a cooperative button game." \
  --no-launch
```

Those flag names come from the current development parser; run
`bun run src/index.ts -- --help` in the checkout for its complete surface.
`--template` names which example to start from, and it clones that example's
repository — the harness generates no game and carries no bundled template
archive. **Agent mode requires `--source` spelled out.** At a prompt, or with
flags alone, `--template button` is enough to imply the template source; under
`--agent` the source is a required input, and leaving it out returns
`{"ok":false,"error":{"code":"missing_inputs",...,"missing":["source"]}}`
rather than guessing. The draft's
[implementation PR](https://github.com/keicoin-org/create-kei-game/pull/1)
links its agent-mode guide, which documents config files, bounded stdin,
precedence, and machine result shapes.

::: warning The npm package is the old scaffolder
`create-kei-game@0.2.0` on npm is the superseded package published from
`kei-transaction`; it is not this harness. The current draft validates
onboarding and agent input and prepares the selected source, then stops. Its
model/tool loop, Kei terminal UI, and persisted workflow are not released yet.
The engine that will run them, and the JSON-lines boundary both front ends talk
over, are a
[second unmerged draft](https://github.com/keicoin-org/create-kei-game/pull/3)
with scripted transports and no provider adapter.
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
