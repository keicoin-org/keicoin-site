---
title: Player rewards
description: How Button turns presses and mob drops into recipient-bound claims the player signs for themselves.
---

# Player rewards

## Outcome

![Local Button game showing the green button, reward counter, NPC shop board, shopkeeper, and targets](/img/docs/button-gameplay.png)

*The button and the targets are gameplay inputs, and the board is UI. The claims behind those numbers are signed through the protocol below.*

<!--@include: @/evidence/button-gameplay.md-->

The issuer decides what a reward is worth; the player writes it to their own chain.

`game.bank()` and `game.loot()` both return a `ClaimBundle` — a proof against a root the
issuer published, bound to one recipient address. The server never signs for a player's
wallet, so nothing lands until the player calls `player.claims.add(bundle)`.

```ts
const bundle = await game.bank(player.address, 12)
await player.claims.add(bundle)
// coins.balance() === 12
```

There is no balances table, no inventory table, and no ledger of who owns what on the
server. `server/game.ts` says so outright: those are questions the chain answers, and
asking it is `balanceOf`.

## Before you begin

Start the issuer with a seed and a node. The seed is why this half cannot run in a
browser (SPEC §6.3).

```ts
const game = await startGame({
  seed: randomSeed(),
  node,                    // a KeiNode or an RPC URL
  network: 'mock',
  flushMs: 1_500,          // how long banked presses wait to be batched
  pressRateCap: 25,        // presses/second above which a bank is not a human hand
  exchange: true,          // SPEC §8: the demo must be fun with payments off
})
```

On startup the issuer funds itself if needed (the nth asset an account issues burns n
Kei, and this game issues one currency plus five upgrades, so 21 Kei in total), issues
the coin with `transfer: 'open'` and `swap: 'one-way'`, and creates each upgrade as a
native item.

`game.catalogue()` returns the issuer address, network, coin asset/symbol/decimals, the
exchange terms, and the upgrade list with resolved asset ids. The player needs the coin
asset id to open a token handle:

```ts
const coins = await player.token(game.catalogue().coin.asset)
```

## Press rewards

```ts
bank(address: string, presses: number): Promise<ClaimBundle>
```

`game.bank` does three things:

1. **Caps the count.** The client counts presses, which `server/game.ts` calls a real
   trust hole and explicitly not a fix for it — a ceiling, so the hole is worth a few
   coins rather than the supply. The allowance is
   `Math.max(1, Math.ceil((since / 1_000) * rateCap) + rateCap)` where `since` is the ms
   since this address last banked; the counted presses are
   `Math.min(Math.floor(presses), allowed)`. A client claiming 1,000,000 presses at a cap
   of 25 gets under 200 coins. The comment notes that putting Colyseus in the room is what
   makes presses observed rather than asserted; that multiplayer work is still unmerged.
2. **Prices the press.** `payoutFor()` is fed the player's holdings read off the chain
   via `kei.client.node.holdings(address)` — an empty wallet is `{ perPress: 1 }`, and
   e.g. two `knuckle` copies make it 9.
3. **Batches the drop.** Every player who banks in the same `flushMs` window lands in
   **one** issuer block. `DropBatch` commits `[{ to, amount }]` for the whole batch and
   hands each address `drop.proofFor(address)`.

Zero presses is an error, not a block: `throw new GameError('That was zero presses.')`.

Batching is the point of §5.5 — minting per player would make the issuer's chain a global
write lock. Instead the issuer publishes one root and each player writes their own claim
from their own chain, in parallel, with no contention. With one player it is a batch of
one and the code is identical.

Two banks by the same address inside one window are **merged into one leaf**, not two: a
root commits to at most one entitlement per account. Both calls resolve to the same
bundle (same `root`, same `amount`), and claiming once credits the sum.

## Loot rewards

```ts
loot(address: string, mob: string): Promise<ClaimBundle>
```

Mobs are validated against `/^slime-[1-3]$/`; anything else is
`GameError('That mob does not exist.')`. A defeat is a flat **25 coins**, added to the
same `DropBatch` as presses.

Retries are deduplicated per `${address}:${mob}`. The in-flight promise is stored
*before* awaiting, so double clicks cannot publish two leaves; a second call returns the
identical bundle. If the drop fails, the key is deleted so the mob can be looted again.

```ts
const [first, retry] = await Promise.all([
  game.loot(player.address, 'slime-2'),
  game.loot(player.address, 'slime-2'),
])
// retry equals first
```

## Claim safely

`player.claims.add(bundle)` stores the bundle and then claims everything in one shared
map. Two callers can read the same held bundle before either submits, and one loses with
"root was already claimed". Banking is not the only caller — mob drops use the same
wallet — so `src/claim-queue.ts` puts the lock at the claim call rather than around one
feature:

```ts
export function serialClaims<T>(write: (bundle: T) => Promise<unknown>): (bundle: T) => Promise<void> {
  let tail: Promise<void> = Promise.resolve()

  return (bundle: T): Promise<void> => {
    const run = tail.then(async () => {
      await write(bundle)
    })
    // A failed claim is still returned to its caller, but must not wedge every
    // claim queued after it. The tail observes and absorbs only for sequencing.
    tail = run.catch(() => undefined)
    return run
  }
}
```

A failure propagates to its own caller but the tail swallows it, so one bad claim does
not wedge the queue behind it.

## State and errors

What is held in memory on the server, and dies with the process:

| State | Where | Lifetime |
| --- | --- | --- |
| `lastBank` per address | rate ceiling | process |
| `pending` / `waiting` / `failures` | `DropBatch` | until flush |
| `lootClaims` per `address:mob` | loot dedupe | process |
| `orders` per address | shop | `ORDER_TTL_MS` = 120s |

Errors: `GameError` is the "your fault, here is a sentence" class and maps to HTTP 400;
anything else maps to 500. A malformed body is `GameError('That request was not JSON.')`.
If `coins.commit()` throws, every waiter in that batch is rejected with the same error.

Known gaps, from these files:

- **Persistence** — none. `MockNode.create()` is in memory and a fresh chain every run;
  `server/main.ts` says the chain "dies with this process". The player's wallet lives in
  their browser and outlives it, so they come back to an empty account on a new chain,
  which the file calls the honest behaviour for a mock. There is no server-side store at
  all.
- **Auth** — none. `/game/bank` and `/game/loot` take an `address` in the request body
  with no signature, session, or ownership check, so any caller can bank for any address.
  (The reward is recipient-bound, so this grants coins to that address, not to the
  caller.)
- **Rate limiting** — only the per-address press ceiling inside `bank`, derived from wall
  clock and keyed by the client-supplied address. There is no HTTP-level or per-IP limit,
  and `loot` has no rate limit at all.
- **Idempotency** — `loot` dedupes per `address:mob` in memory; `bank` has no request id
  or replay protection beyond the in-window merge. Nothing survives a restart.
- **Order matching** — a transfer carries no memo (decisions-m0 §4), so intent is
  recorded in `orders` first and matched to `asset-received`. The order is not the
  purchase; nothing is delivered until the chain says the coins landed.

## Network boundary

The dev server is one process serving three unrelated things: `/rpc` (an in-memory
`MockNode` via `mockRpcHandler`), `/game/*` (the issuer), and `/` (the client bundle).
They are one process "because it is one `bun run dev`, not because they belong together."

The player's browser reaches the node directly and signs everything it writes. This
server never sees a player's key and cannot move their money.

This is **not** a public, persistent network. `network: 'mock'`, the chain is in memory,
and the startup banner says plainly: "Nothing here is worth anything, which is the point
of M1" — a milestone label from before the ladder was retired, still in that source line.
`/rpc` is a development tool; the real node exists and pointing this URL at it changes
nothing above it. CORS is wide open (`access-control-allow-origin: *`).

Endpoints:

| Route | Method | Body | Returns |
| --- | --- | --- | --- |
| `/game/catalogue` | GET | — | `game.catalogue()` |
| `/game/bank` | POST | `{ address, presses }` | `{ bundle }` |
| `/game/loot` | POST | `{ address, mob }` | `{ bundle }` |
| `/game/order` | POST | `{ address, sku }` | `{ to, price, asset }` |

## Test it

`test/economy.test.ts` runs against the same in-memory chain the game runs against, so a
green suite means the loop works, not that it was mocked. The fixture uses `flushMs: 20`
and `pressRateCap: 100_000` so a test wanting 400 coins does not spend sixteen seconds
earning them at a human rate.

```ts
test('banked presses become coins the player claims for themselves', async () => {
  const { game, player } = await table()
  const coins = await player.token(game.catalogue().coin.asset)

  const bundle = await game.bank(player.address, 12)
  expect(bundle.root).toMatch(/^[0-9A-F]{64}$/)

  await player.claims.add(bundle)
  expect(await coins.balance()).toBe(12)
}, 20_000)
```

Covered there: one root across three players banking in the same window (with each
address crediting its own amount); two banks in one window as one leaf; the press ceiling;
zero presses; loot claim and loot retry; and — because delivery is asynchronous by design
— an `until()` poller rather than anything that blocks a game loop.

## Next steps

- Buy an upgrade and watch it change what the next press is worth, read off the chain.
- Turn the exchange desk off (`BUTTON_EXCHANGE=off`) and confirm pressing still pays.
- Point `/rpc` at the public node at `https://testnet.keicoin.org/rpc`; nothing above it changes.

**Unknown from these files:** where `serialClaims` is wired into the client, the
auto-clicker (`pressesPerSecond`) loop, the world/Babylon layer, and the exact
`ClaimBundle` field set beyond `root` and `amount`.
