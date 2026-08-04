---
title: Button fundamentals
description: Open a player wallet, price presses on the server, commit a batch as one issuer block, and claim it from the player's own account — the Button loop as a runnable script.
---

# Button fundamentals

**By the end of this page you have run the whole Button money loop in one file: a wallet the player owns, presses priced by a server that cannot touch them, one issuer block covering a batch, and a claim the player signs — with a confirmed balance to check it against.**

[Button](../button.md) wraps this loop in Babylon.js, a shop and an exchange desk. None of that is here. This page is the four calls underneath, in the order they happen, against an in-process chain.

## Before you begin

| | |
| --- | --- |
| SDK | `bun add kei-transaction` — a plain dependency. That installs the current published release, `0.5.0`, which is what this page is written against. |
| Runtime | Bun 1.3, or Node 20 or later. `Kei.server()` refuses to run in a browser. |
| Chain | `MockNode` — in-memory, in this process, gone when it exits |
| Seeds | Two. The issuer's, held by the server; the player's, held by the player. One key signs for one account and there is no `charge(someoneElse, …)`. |
| Kei to spend | Issuing an asset burns 1,000 Kei. `faucet()` covers that off mainnet, where it throws. |
| Source this was read from | `server/game.ts`, `src/economy.ts` and `test/economy.test.ts` in [the Button repository](https://github.com/keicoin-org/button) |

You do not need the game running, a browser, a port, or a node URL. Nothing on this page opens a socket.

## The flow

| Step | Who | What is signed |
| --- | --- | --- |
| **Press** | The client, in memory | Nothing. A press is a count, not a transaction. |
| **Bank** | The game server | Nothing yet. It prices the presses and puts `address → amount` in the open batch. |
| **Commit** | The issuer | One block, `coins.commit(entries)`, however many players are in the batch. Each player's `drop.proofFor(address)` is plain JSON. |
| **Claim** | The player | Their own block, `kei.claims.add(bundle)`, from their own account, in parallel with everyone else's. |

The reason it is shaped this way: one account has one chain, so an issuer that minted per player would be a global write lock with the queue behind it as the game. One commit underwrites an unbounded number of parallel claims.

## Run the loop

Save this as `press-to-coins.ts` and run `bun run press-to-coins.ts`.

```ts
// press-to-coins.ts — the Button loop with the 3D world taken off it.
import { Kei, MockNode, randomSeed, type ClaimBundle } from 'kei-transaction'

// An in-process chain. Nothing here opens a socket, and nothing survives the run.
const node = await MockNode.create()

// ---------------------------------------------------------- the game server
// Kei.server holds the issuer seed, which is why it refuses to run in a browser.
const game = await Kei.server({ seed: randomSeed(), node, network: 'mock' })
// Issuing an asset burns 1,000 Kei. On a real network somebody funds this once.
if ((await game.balance()) < 1_100) await game.faucet(1_100)

const coins = await game.token.issue({
  name: 'Coins',
  symbol: 'COIN',
  decimals: 0,
  maxSupply: 1_000_000_000,
  transfer: 'open',
})

/** What a press is worth is the server's business. It is not on the chain. */
const PER_PRESS = 1
/** Presses a second above which a bank was not a human hand. */
const PRESS_RATE_CAP = 25

const batch = new Map<string, number>()

/** Price a player's presses into the next batch. Nothing is signed here. */
function bank(address: string, presses: number, secondsSinceLastBank: number): number {
  const allowed = Math.max(1, Math.ceil(secondsSinceLastBank * PRESS_RATE_CAP) + PRESS_RATE_CAP)
  const counted = Math.min(Math.floor(presses), allowed)
  if (!(counted > 0)) throw new Error('That was zero presses.')
  // Merged per address: a root commits to at most one entitlement per account,
  // so two banks inside one window are one leaf rather than two.
  const owed = counted * PER_PRESS
  batch.set(address, (batch.get(address) ?? 0) + owed)
  return owed
}

/** One issuer block for everyone who banked in this window. */
async function flush(): Promise<Map<string, ClaimBundle>> {
  const entries = [...batch]
  batch.clear()
  if (entries.length === 0) return new Map()
  const drop = await coins.commit(entries.map(([to, amount]) => ({ to, amount })))
  return new Map(entries.map(([to]) => [to, drop.proofFor(to)]))
}

// --------------------------------------------------------------- the player
// Its own key, its own chain. The game cannot sign for it.
const player = await Kei.start({ node, seed: randomSeed() })
const wallet = await player.token(coins.id)

bank(player.address, 12, 1)
const bundles = await flush()
const bundle = bundles.get(player.address)!

console.log('root   ', bundle.root)
console.log('amount ', bundle.amount, '— raw units, as a string')

// The claim is written by the player, from the player's own account.
const [claimed] = await player.claims.add(bundle)

console.log('claim  ', claimed?.hash)
console.log('balance', await wallet.balance())
console.log('pending', (await player.claims.pending()).length)

game.close()
player.close()
```

The hashes differ every run — the seeds are random and so is the salt that makes one batch a different root from an identical one. The rest does not:

```
root    1D7EDF3475221CA52BFC70E7FF6788605945FFC74DEFC31DD2DE6D2F291D8B12
amount  12 — raw units, as a string
claim   0E2B27273D22F59FC039EB67CD342DF92C79037ABD5505BF5856210AC3E85177
balance 12
pending 0
```

### What each call gives you

| Call | Returns |
| --- | --- |
| `Kei.start({ node, seed })` | The player. `address`, `balance()`, `token(assetId)`, `claims`, `wallet`. Omit `seed` and one is generated and persisted. |
| `Kei.server({ seed, node, network })` | The issuer. Same surface plus `token.issue()` and `items`; `seed` is required and a browser is refused. |
| `game.token.issue(options)` | An `IssuerToken` — `id`, `decimals`, `commit()`, `mint()`, `burn()`, `close(root)`. Idempotent per issuer and symbol, so a restart returns the same asset rather than paying for a second one. |
| `coins.commit(entries)` | A `PublishedCommit`: `root`, `hash`, `count`, `total`, `salt`, `proofFor(address)`, `amountFor(address)`. |
| `drop.proofFor(address)` | A `ClaimBundle` — `{ root, asset, amount, proof }`, plain JSON, serialisable, deliverable however you already talk to that player. |
| `player.claims.add(bundle)` | `ClaimResult[]` — each with `root`, `asset`, `amount` and the claim's `hash`. Also on `claims`: `pending()`, `claimAll()`, `claim(bundle)`. |
| `player.token(coins.id)` | A `PlayerToken` — `balance()`, `balanceOf(address)`, `transfer()`, `on('transfer', …)`. |
| `player.wallet.summary()` | `{ address, kei, tokens, items, pending }` in one read. This is what Button rebuilds a player's progression from; there is no save file. |

::: tip `bundle.amount` is raw units, as a string
It is a string so no precision is lost in transit, and raw so it does not depend on anyone agreeing about decimals. Display units are `Number(bundle.amount) / 10 ** decimals`. It reads `12` above because this token has `decimals: 0`.
:::

## In-process here, over HTTP in the game

The snippet passes one `MockNode` object to both halves, so the issuer and the player share a ledger through memory. That is the same chain Button's own tests run against, and it is why they are fast.

Button itself puts a wire between the two halves without changing any of the four calls:

| | This page | Button |
| --- | --- | --- |
| Node | A `MockNode` object passed in directly | `mockRpcHandler({ node })` served at `/rpc`; the browser calls `Kei.start({ node: '…/rpc', network: 'mock' })` |
| Banking | A local `bank()` function | `POST /game/bank` with `{ address, presses }`, answering `{ bundle }` or `{ error }` |
| The bundle | Handed over as an object | The same JSON, over the wire |
| Claiming | `player.claims.add(bundle)` | `kei.claims.add(bundle)` — identical, and the game is not involved |

Two things to be clear about:

- **`'mock'` is a network name, not a pretend one.** It means a node serving `mockRpcHandler` rather than a public network. Served over HTTP it exercises a real HTTP client and server — the same transport boundary a real node sits behind — but it is not a persistent, public, production network and there is no independent consensus behind it: it is still in-memory, still dies with the process, and nothing on it is worth anything.
- **A real node is a URL change.** Point `node` at one and everything above this line is unchanged. Button's `test/m4-native.test.ts` is what runs commit and claim against a native node, and it is what makes that a checked statement rather than a hope.

There is no call in this loop that asks the game server for a balance. Balances come from the node, which is the only side that can be trusted about them.

## State and errors

Where a coin can be between a press and a balance:

| State | Chain state? | How you read it |
| --- | --- | --- |
| Pressed, unbanked | No | The client's own counter. Reloading loses it. |
| Banking | No | A request is out; nothing is signed and nothing is owed yet |
| Committed | Yes — the root | The bundle exists. The coins are **not** in the balance, and no balance call will show them. |
| Claim written | Yes | `token.balance()` rises; `claims.pending()` no longer lists it |

Failures, and what each one leaves behind:

| | What happens |
| --- | --- |
| Zero or negative presses | `That was zero presses.` — the game's own refusal, before anything is committed. Button returns it as HTTP 400. |
| A press rate no hand could produce | Not an error. The server caps it and the bundle carries the capped figure, which is why the client reads `bundle.amount` instead of trusting its own count. |
| The bank request fails | Nothing was signed, so the presses are still owed. Put them back and let the next window bank them. |
| The claim fails after a good bundle | The SDK keeps the bundle: `claims.pending()` still lists it and the next `claims.add()` retries. Do not re-credit the player locally — the coins arrive as a rise in the chain's own figure or not at all. |
| A second claim on the same root | Rejected by the ledger: `kei_… has already claimed from drop 1D7EDF…`. Replay is not yours to solve. |
| A forged proof, a changed amount, a claim for another account | Rejected by the ledger, whatever your server did. |
| Two claim sweeps at once | `claims.add()` and `claims.claim()` work from one shared map of held bundles, so overlapping sweeps can read the same bundle before either submits and the loser is told the root is already claimed. Button serialises every claim through one queue (`src/claim-queue.ts`) rather than letting two run. |

## Security boundaries

- **The issuer seed never reaches a browser.** `Kei.server()` requires a seed and refuses to start in one. Banking, commits and issuance are server-side because they are signed by the issuer's key.
- **The game never holds the player's key.** The player's claim is signed by the player. There is no arrangement in the API where one account signs for another.
- **A bundle is bound to its recipient, not to whoever holds it.** The leaf and proof commit to the recipient's account, so a forged bundle, an altered amount or another account's claim is rejected by the ledger. It is still not public data: deliver it down the authenticated session that already knows which player this is, so you do not leak who is entitled to what, and so a client cannot enumerate or withhold other players' bundles.
- **The ledger checks the proof, not the gameplay.** It will reject a forged bundle, an altered amount, another account's claim and a replay. It will not tell you whether those presses happened. Deciding what a player earned stays entirely yours.
- **Button's client counts its own presses**, which is a real trust hole; the rate cap makes it worth a few coins instead of the supply, and it is written down in the source rather than hidden. A server that observes the gameplay is what actually closes it.
- **Grade spending on confirmed balances only.** A committed-but-unclaimed entitlement is not money the player has.

## Tests

The claims in the snippet's comments are checked in the Button repository:

```sh
git clone https://github.com/keicoin-org/button
cd button
bun install
bun test
```

`test/economy.test.ts` runs against the same in-process chain the snippet uses, and covers this loop directly:

- banked presses become coins the player claims for themselves;
- one root covers every player who banked in the same window;
- two banks inside one window are one leaf, not two;
- a client claiming a million presses gets a ceiling instead;
- zero presses is a sentence, not a block.

`test/m4-native.test.ts` runs commit and claim against a native node, which is the pair worth trusting: a green in-process suite proves the arithmetic, and only the native one proves the chain.

## Next steps

- [Batch rewards](../../reference/claims.md) — `commit`, `proofFor`, `close(root)` and the claims API on their own.
- [Wallet reference](../../reference/wallet.md) — `Kei.start`, balances, and `wallet.summary()`.
- [Button](../button.md) — the same loop with a shop, an exchange desk and a 3D button on top, including how a purchase takes two signatures and how the shopkeeper delivers an item.
- [Items reference](../../reference/items.md) — the asset an upgrade arrives as once a purchase settles.
- [Loot and drops](../world-of-wonder/loot-and-drops.md) — the same commit-and-claim shape, from the other side: a game where it is not built yet.
- [Security rules](../../guide/security.md) — why nothing here mints on request.
