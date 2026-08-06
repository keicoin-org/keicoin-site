---
title: Player rewards
description: How Button proves who is asking, watches what they did, and turns presses and mob drops into recipient-bound claims the player signs for themselves.
---

# Player rewards

## Outcome

![Local Button game showing the green button, reward counter, NPC shop board, shopkeeper, and targets](/img/docs/button-gameplay.png)

*The button and the targets are gameplay inputs, and the board is UI. The claims behind those numbers are signed through the protocol below.*

<!--@include: @/evidence/button-gameplay.md-->

The issuer decides what a reward is worth; the player writes it to their own chain. Before either of those, the server has to answer two questions no request body is trusted to state: **who** is asking, and **what** they actually did. Session and observation (below) are the code that answers both.

`game.bank()` and `game.loot()` both return a `Payout` — `{ bundle, amount }`. `bundle` is a `ClaimBundle`, a proof against a root the issuer published, bound to one recipient address; `amount` is this call's own share of it, because a bank and a mob drop can land in the same issuer block. The server never signs for a player's wallet, so nothing lands until the player calls `player.claims.add(bundle)`.

```ts
const session = await proveAddress(player) // sign a challenge, once
await press(session)                        // as many times as the player presses
const { bundle, amount } = await game.bank(session, origin, batchId())
await player.claims.add(bundle)
// coins.balance() === amount
```

There is no balances table, no inventory table, and no ledger of who owns what on the server. `server/game.ts` says so outright: those are questions the chain answers, and asking it is `balanceOf`.

## Before you begin

Start the issuer with a seed and a node. The seed is why this half cannot run in a browser (SPEC §6.3).

```ts
const game = await startGame({
  seed: randomSeed(),
  node,                    // a KeiNode or an RPC URL
  network: 'mock',
  flushMs: 1_500,          // how long banked presses wait to be batched
  pressRateCap: 25,        // observations/second above which this server stops watching
  exchange: true,          // SPEC §8: the demo must be fun with payments off
})
```

On startup the issuer funds itself if needed (the nth asset an account issues burns n Kei, and this game issues one currency plus five upgrades, so 21 Kei in total), issues the coin with `transfer: 'open'` and `swap: 'one-way'`, and creates each upgrade as a native item.

`game.catalogue()` returns the issuer address, network, coin asset/symbol/decimals, the exchange terms, and the upgrade list with resolved asset ids. It is the one route with no session, because it is a price list and nobody's business but a caller's own. The player needs the coin asset id to open a token handle:

```ts
const coins = await player.token(game.catalogue().coin.asset)
```

## Prove the address, once

Every rewarding method on `Game` takes a **session id**, never an address. `server/sessions.ts` is what turns one into the other, and it is the only thing in this repository that decides who a caller is or what this server watched them do.

```ts
session.challenge(address: string, origin: string): OwnershipChallengeMessage
session.authenticate(proof: unknown, origin: string): Promise<Session>
```

`challenge()` mints a one-use, 60-second nonce and signs it into a message bound to this address, this running issuer (`room`), and the caller's origin. The player's wallet signs that challenge — `kei.wallet.signOwnershipChallenge()` where the SDK has it, or the interim `src/ownership.ts` signer while it does not — and posts the proof back. `authenticate()` checks the signature, checks the nonce was issued here and not already spent, checks the origin matches, and hands back a session id. Everything after that carries the id and nothing else:

```ts
const { challenge } = await post('/game/session/challenge', { address: player.address })
const proof = await sign(player, challenge)
const { session } = await post('/game/session', { proof })
// every following call: { session, ...whatever that call needs }
```

A session id that leaks to another page authenticates nothing there — origin is checked again on every use, not only at authentication. A session goes quiet for 30 minutes and is gone; reconnecting is one more signature, and it does not reset the observation ceiling below, which is keyed on the address rather than the session.

## Observation: what this server watched happen

A proof of wallet control says who is asking. It does not say what they did, and this game does not ask a client to state that either.

```ts
session.press(id: unknown, origin: string): PressReceipt   // { observed, remaining }
session.hit(id: unknown, origin: string, mob: unknown): HitReceipt
```

The client posts `/game/press` on every press — no count in the body, because the count is this request having arrived. The server increments a per-session tally and spends one token from a per-**address** bucket (`DEFAULT_OBSERVATION_RATE = 25`/second, two seconds' burst by default). Past the ceiling, `/game/press` is refused with a sentence naming the rate, and the client simply does not count that press toward the tally — it was never observed, so there is nothing to bank.

The bucket's ceiling is not fixed at 25 forever: `bank()` reads what the address's on-chain items are worth in presses-per-second (`payoutFor`) and calls `session.machines(address, pressesPerSecond)`, which raises the rate and the burst room together. An address running nine Auto-Presser Mk IIs presses legitimately faster than any hand, and the ceiling has to count that or it clips the exact purchase that produced it. Machines never *refill* the bucket — they only raise the room it can hold.

Mobs work the same way from the other direction: `hit()` requires 3 recorded hits before it says a mob died, validates the mob name against `/^slime-[1-3]$/`, and spends the same observation bucket a press does — so a script cannot spend its ceiling on kills instead of presses. The moment the third hit lands, the mob is marked spoken-for **for that address**, before there is anything to redeem — a second `hit()` on an already-dead mob is refused, which is what stops a kill from being farmed by re-hitting between the death and the loot call.

## Press rewards

```ts
bank(session: unknown, origin: string, batch: unknown): Promise<{ bundle: ClaimBundle; amount: number }>
```

`game.bank` does three things:

1. **Takes the observed tally, synchronously.** `sessions.take()` reads the session's press count and zeros it in one step, before anything is awaited — two banks in flight divide the tally rather than both selling it. Zero observed presses is `GameError('This server has not seen any presses from you yet.')`, not a zero-amount block.
2. **Prices the press.** `payoutFor()` is fed the player's holdings read off the chain via `kei.client.node.holdings(address)` — an empty wallet is `{ perPress: 1 }`, and e.g. two `knuckle` copies make it 9. The same read also updates this address's observation ceiling (above), so a purchase raises both what a press is worth and how fast pressing is believed.
3. **Batches the drop.** Every player who banks in the same `flushMs` window lands in **one** issuer block. `DropBatch` commits `[{ to, amount }]` for the whole batch and hands each address its own share of `drop.proofFor(address)` — never the whole block's total, because a bank and a loot can land in the same window and each caller gets only what it itself contributed.

A bank names the batch it is paying for. `batch` is a caller-chosen id, up to 64 characters of letters, digits, `.`, `_`, or `-`; a bank with none is `GameError('A bank names the batch...')` and the presses it would have spent are never touched. Sending the **same** id again — because a response was lost, not because more was pressed — is answered with the identical proof rather than publishing a second entitlement:

```ts
const first = await game.bank(session, origin, 'attempt-1')
const retry = await game.bank(session, origin, 'attempt-1')
// retry.bundle.root === first.bundle.root, retry.amount === first.amount
```

If publishing fails after the tally was taken, the presses go back to the session (`sessions.restore`) rather than being lost, and the same batch id can be retried once the failure clears.

Batching is the point of §5.5 — minting per player would make the issuer's chain a global write lock. Instead the issuer publishes one root and each player writes their own claim from their own chain, in parallel, with no contention. With one player it is a batch of one and the code is identical.

## Loot rewards

```ts
loot(session: unknown, origin: string, event: unknown): Promise<{ bundle: ClaimBundle; amount: number }>
```

`loot` does not take a mob name. It takes the **event id** `hit()` returned when it watched this address land the third blow — the caller names which recorded kill to collect, never which mob and never what it was worth. An event is consumed the moment `redeem()` reads it (before the payout is awaited), so two collections of one kill cannot both reach the issuer; if the payout itself then fails, the event is restored so the same kill can be retried, without reopening the mob to a second kill.

A defeat is a flat **25 coins** (`MOB_DROP`), added to the same `DropBatch` presses use — a bank and a loot in the same window can land in the same issuer block, each crediting its own share.

```ts
let event: string | undefined
for (let blow = 0; blow < 3 && !event; blow++) {
  ({ event } = await game.hit(session, origin, 'slime-1'))
}
const { bundle, amount } = await game.loot(session, origin, event)
await player.claims.add(bundle)
// amount === 25
```

## A starting balance

```ts
faucet(session: unknown, origin: string): Promise<{ granted: number }>
```

The node's own RPC faucet is not reachable by a stranger (`server/rpc.ts`'s allow-list refuses the `faucet` action outright — see [Network boundary](#network-boundary)). This is what replaced it, and everything that made the RPC faucet a hole is the opposite here: the amount is a constant (`FAUCET_KEI = 10`) with no field for a figure, the recipient is the proven session's own address and nobody else's, and a wallet is granted once an hour and only while its on-chain balance is zero. There is no faucet at all on `network: 'mainnet'` — `GameError('There is no faucet on mainnet. Fund this wallet and come back.')`.

## Buying, and how a purchase reports back

```ts
order(session: unknown, origin: string, sku: string): Promise<{ id: string; to: string; price: number; asset: string }>
purchases(session: unknown, origin: string): PurchaseReceipt[]
```

`order()` is session-bound like everything else: the payer is the proven wallet, never an address out of the body, because letting a caller name somebody else's address is how a victim's payment delivers the wrong item to a stranger. It checks the coin balance on-chain, reserves the requested sku's remaining supply synchronously (so two callers racing the last copy cannot both be told to pay), and records the order.

A coin transfer carries no memo, so the order is what turns "coins arrived" into "this address bought this sku." `settle()` (triggered off the issuer's own `asset-received` subscription) has exactly two honest endings for coins it receives against an order — the item, or the coins back — and every branch reaches one:

| What arrived | What happens |
| --- | --- |
| No open order for that address | Returned, receipt `returned`, reason "the shop had no open order for it" |
| The order is already being delivered | Returned, reason "already being delivered" |
| Less than the price | Returned, order stays open for the right amount |
| Exactly the price, or more | Item minted; price burned; any excess returned as change |
| The mint itself fails (supply gone, node hiccup) | Full payment returned, reason names the failure |

Because the shop can't push anything to the browser — the transfer is signed by the player and settled by the chain, out of band from any request — `purchases()` is the only channel back. It returns this session's own receipts, newest last, so a reloaded browser recovers "delivered" or "returned" from its wallet alone rather than being stuck on the optimistic message a purchase started with.

```ts
const order = await game.order(session, origin, 'glove')
await coins.transfer(order.to, order.price)
// poll, because delivery is asynchronous
let receipt
while (!receipt || receipt.state === 'open') {
  await sleep(50)
  receipt = game.purchases(session, origin).find((r) => r.id === order.id)
}
// receipt.state === 'delivered'
```

## Claim safely

`player.claims.add(bundle)` stores the bundle and then claims everything in one shared map. Two callers can read the same held bundle before either submits, and one loses with "root was already claimed". Banking is not the only caller — mob drops and purchases' refunds use the same wallet — so `src/claim-queue.ts` puts the lock at the claim call rather than around one feature:

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

A failure propagates to its own caller but the tail swallows it, so one bad claim does not wedge the queue behind it.

## State and errors

What is held in memory on the server, and dies with the process:

| State | Where | Lifetime |
| --- | --- | --- |
| `pending` challenges | `sessions.ts` | 60s, or one use |
| `sessions` | `sessions.ts` | 30 minutes of quiet |
| `buckets` (observation ceiling) | `sessions.ts`, keyed by address | swept once a full bucket has been idle 30 minutes |
| `looted` (`address:mob`) | `sessions.ts` | process — survives a new session for the same address |
| `pending` / `waiting` / `failures` | `DropBatch` | until flush |
| `open` / `published` batches | `BatchLog` | published entries kept 5 minutes for retry |
| `given` (faucet grants) | `Faucet` | one hour per address |
| `orders` per address | shop | `ORDER_TTL_MS` = 120s |
| `receipts` per address | shop | `RECEIPT_TTL_MS` = 10 minutes, last 8 kept |

Errors: `GameError` is the "your fault, here is a sentence" class and maps to HTTP 400; anything else maps to 500. A malformed body is `GameError('That request was not JSON.')`. If `coins.commit()` throws, every waiter in that batch is rejected with the same error.

Known gaps, from these files:

- **Persistence** — none. `MockNode.create()` is in memory and a fresh chain every run; `server/main.ts` says the chain "dies with this process." The player's wallet lives in their browser and outlives it, so they come back to an empty account on a new chain, which the file calls the honest behaviour for a mock. Sessions, buckets, batches and receipts are all in-memory too, so a restart forgets every open session and every pending grant along with the chain.
- **Origin binding is a courtesy, and the README says so.** It stops another page from silently reusing a session that leaked to it. A caller that is not a browser can set `Origin` to anything or omit it, and nothing here claims otherwise.

## Network boundary

The dev server is one process serving three things: `/rpc` (the same in-memory `MockNode`, wrapped by an allow-list that refuses everything that can create money), `/game/*` (the issuer), and `/` (the client bundle). They are one process "because it is one `bun run dev`, not because they belong together."

**`/rpc` is public and stays public** — the browser half of this demo is a real wallet, and a real wallet has to read its own balance and publish its own signed blocks without the game server standing between it and the chain. What is not public on it is anything that creates money: `guardRpc` wraps the handler in an allow-list of read and publish actions (`account_info`, `process`, `asset_info`, …) and refuses everything else, `faucet` included, with `This node does not mint. A starting balance comes from the game, at /game/faucet.` It is an allow-list rather than a deny-list on purpose — an action the SDK adds later is refused until somebody looks at it, rather than silently reachable.

This is **not** a public, persistent network. `network: 'mock'`, the chain is in memory, and it dies with the process. CORS is wide open on both surfaces (`access-control-allow-origin: *`).

Endpoints, all under `/game/*` except the RPC surface:

| Route | Method | Body | Returns |
| --- | --- | --- | --- |
| `/game/catalogue` | GET | — | `game.catalogue()` — no session |
| `/game/session/challenge` | POST | `{ address }` | `{ challenge }` |
| `/game/session` | POST | `{ proof }` | `{ session, address, room }` |
| `/game/press` | POST | `{ session }` | `{ observed, remaining }` |
| `/game/hit` | POST | `{ session, mob }` | `{ mob, hits, needed, event? }` |
| `/game/bank` | POST | `{ session, batch }` | `{ bundle, amount }` |
| `/game/loot` | POST | `{ session, event }` | `{ bundle, amount }` |
| `/game/faucet` | POST | `{ session }` | `{ granted }` |
| `/game/order` | POST | `{ session, sku }` | `{ id, to, price, asset }` |
| `/game/purchases` | POST | `{ session }` | `{ purchases }` |
| `/rpc` | POST | `{ action, ... }` (allow-listed only) | the node's own reply shape |

None of these take an `address`. The session already says who is asking; naming one in the body is either ignored or refused, and `test/api.test.ts` asserts both directions — a body naming a victim address still pays the proven wallet, never the named one.

## Test it

`test/api.test.ts` drives both front doors — the Bun dev server and the deployed Worker's router — through the same requests a browser sends, which is what closes a boundary that used to be written out twice. `test/economy.test.ts` and `test/sessions.test.ts` exercise the game logic directly against the same in-memory chain the game runs against, so a green suite means the loop works, not that it was mocked.

```ts
test('a press count in the body is not read, however large', async () => {
  const session = await authenticate(arena)
  await pressThrough(arena, session, 3) // three real /game/press calls

  const { body } = await arena.door('/game/bank', {
    session,
    batch: batchId(),
    presses: 1_000_000, // every spelling the old route understood
    count: 1_000_000,
    amount: 1_000_000,
    address: arena.player.address,
  })
  await arena.player.claims.add(body.bundle)
  const coins = await arena.player.token(arena.game.catalogue().coin.asset)
  expect(await coins.balance()).toBe(3) // exactly what was observed, not what was claimed
})
```

Covered there: a bank without a session refused before anything is touched; a body naming someone else's address paying the proven wallet instead; the same batch id twice answered with the same proof; twenty concurrent banks selling one tally exactly once; a flood of presses bounded by the ceiling rather than by how fast they arrive; a session id rejected at a different origin; loot refusing a bare mob name and paying only a real event; a purchase followed through to `delivered` via `/game/purchases`; and the `/rpc` allow-list refusing the faucet action under every spelling issue #30 tried.

## Next steps

- Buy an upgrade and watch it change what the next press is worth and how fast the ceiling lets you press, both read off the chain.
- Turn the exchange desk off (`BUTTON_EXCHANGE=off`) and confirm pressing still pays.
- Read `server/sessions.ts` end to end — it is the whole of who-is-asking and what-they-did, in about 350 lines, and nothing described above lives anywhere else.

**Unknown from these files:** where `serialClaims` is wired into the client beyond banking, the auto-clicker (`pressesPerSecond`) loop, and the world/Babylon layer.
