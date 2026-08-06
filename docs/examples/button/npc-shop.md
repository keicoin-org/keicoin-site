---
title: Button NPC shop
description: The shopkeeper purchase protocol in Button — a proven session takes an order, the player's wallet signs the transfer, the server verifies the arrival on-chain and honours it with either the item or a refund, and reports which one happened.
---

# Button NPC shop

**By the end of this page you can run Button's shopkeeper purchase end to end and say exactly who signed what: a proven session quotes a price and records intent, the player's own wallet signs the coin transfer, the server waits for the chain to say the coins landed, and every payment it receives against an order ends at the item or a refund — never at silence.**

The shop is the part of [Button](../button.md) where money leaves a player instead of arriving. That makes it the part with a settlement problem: the game cannot sign for a player's wallet, a coin transfer carries no memo, and the item has to be delivered exactly once — or, when it can't be, the coins have to come back. This page is that protocol, read off the implementation.

::: warning There is no NPC API
Button has no `npc.*`, no `shop.*` SDK surface, and no nested vendor object. The shopkeeper you click is a mesh in `src/world.ts`; the thing that sells you something is a closure called `openShop()` in `server/game.ts`, exposed as two session-bound methods — `game.order(session, origin, sku)` and `game.purchases(session, origin)` — behind two routes, `POST /game/order` and `POST /game/purchases`. "NPC shop" is a description of the fiction, not of an interface.
:::

## Before you begin

| | |
| --- | --- |
| SDK | `bun add kei-transaction` |
| Runtime | Bun 1.3. `Kei.server()` holds the issuer seed and refuses to run in a browser. |
| Chain | The in-memory `MockNode`, served at `/rpc` by the same process — reads and publishing only; the faucet action is refused (`server/rpc.ts`). Nothing on it survives the process. |
| Seeds | Two. The issuer's, held by `server/game.ts`; the player's, held by the browser. Neither can sign for the other. |
| A session | Every route below needs one. Sign the challenge from `POST /game/session/challenge` and redeem it at `POST /game/session` first — see [Player rewards](./player-rewards.md#prove-the-address-once). |
| Coins to spend | Earned by pressing. The shop never sells for Kei — that is the separate exchange desk. |
| Source this was read from | `server/game.ts`, `server/sessions.ts`, `shared/purchase.ts`, `src/economy.ts` and `test/api.test.ts` in [the Button repository](https://github.com/keicoin-org/button) |

Start the game with `bun run dev` and press the button until you can afford the 25-coin Springy Glove, or skip the browser entirely and drive `game.order()` from a test — [Tests](#tests) below is that path.

## The flow

![Local Button game showing the green button, reward counter, NPC shop board, shopkeeper, and targets](/img/docs/button-gameplay.png)

*The left board and the shopkeeper are the UI a player clicks. Purchase authority comes from the session-bound protocol documented below, not from the board.*

<!--@include: @/evidence/button-gameplay.md-->

| Step | Who signs | What it is |
| --- | --- | --- |
| **Quote and record** | Nobody | `POST /game/order` → the server checks the *proven session's* on-chain coin balance and item supply, reserves the sku, records `address → {sku, price}` in memory, and answers with where to pay. |
| **Pay** | The player | `coins.transfer(order.to, order.price)` — the player's own wallet, their own block. |
| **Observe** | Nobody | The issuer's `asset-received` subscription sees the arrival. This is chain state, not a callback the client made. |
| **Settle** | The issuer | Exactly one of: mint the item and burn the price (paid in full), or return the coins with a reason. Never both, never neither. |
| **Report** | Nobody | `POST /game/purchases` answers the proven session's own receipts, so a reloaded browser recovers "delivered" or "returned" without depending on the optimistic message the purchase started with. |

**The order is not the purchase.** The order records intent; the arriving transfer is the fact. An order nobody pays for delivers nothing and is dropped after 120 seconds — the reservation it holds on supply-limited items goes with it.

## Take an order

The client refuses first, on confirmed coins only, so a player whose headline is inflated by clearing rewards gets told which figure was short instead of an order they cannot pay for. The server is still the authority, and it is the server — never the request body — that says whose order this is:

```ts
// src/economy.ts — buy(sku)
const refusal = purchaseBlock(state.coins, upgrade.name, upgrade.price)
if (refusal !== null) {
  state.message = refusal
  changed()
  return
}

const order = await withSession((id) =>
  post<{ id?: string; to?: string; price?: number }>('/game/order', { session: id, sku }),
)
```

On the server the quote is a chain read and a synchronous reservation, not a lookup in a balances table:

```ts
// server/game.ts — Game.order()
order(session, origin, sku) {
  // The payer is the proven wallet, not a body field: an order names the
  // address whose incoming transfer will be matched to it, and letting a
  // caller name somebody else's is how a victim's payment delivers the
  // wrong item.
  const { address } = sessions.require(session, origin)
  return shop.order(address, sku)
}
```

`openShop().order()` checks the on-chain coin balance and the sku's remaining supply (`unsoldCopies`, read from `assetInfo` rather than counted locally), then reserves the copy and writes the order in one synchronous block — no `await` between reading "one left" and reserving it, so two callers racing the last copy cannot both be told to pay. `ORDER_TTL_MS` is 120,000; expired orders are swept opportunistically, when the next order call runs, not on a timer.

## Pay for it

Two signatures, and no third arrangement:

```ts
// src/economy.ts
// The player signs the payment. The shop signs the delivery.
await coins.transfer(order.to, order.price)
state.message = `Bought ${upgrade.name}. It will arrive in a moment.`
```

Nothing about that transfer says what it is for — a transfer carries no memo — which is why the order had to be recorded first and why every arrival is checked against it rather than trusted at face value.

## Purchase verification and idempotent settlement

The server does not trust the client's word that it paid. It subscribes to arrivals and settles each one against the order it matches, awaited by nothing — the arrival comes from a chain subscription, not from a request, so a caught rejection is the only thing between a failed mint and an unhandled rejection taking the whole game server down over one purchase:

```ts
// server/game.ts — openShop()
const stop = kei.on('asset-received', (arrival) => {
  if (arrival.asset !== coins.id) return
  const paid = BigInt(arrival.amount)
  void settle(arrival.from, paid).catch((error) => {
    console.error(`[shop] ${arrival.from} is owed ${paid} ${coins.symbol} and the shop could not settle it:`, error)
  })
})
```

`settle()` is where every branch below lives, and every branch reaches one of exactly two endings — the item, or the coins back:

| What arrived | What happens |
| --- | --- |
| No open order for that address | Returned. Receipt state `returned`, reason "the shop had no open order for it" |
| The matching order is already being delivered | Returned, reason "already being delivered" — a second arrival cannot double-spend an order that is mid-settlement |
| Less than the order's price | Returned, and the order stays open so the right payment can still land the item |
| Exactly the price, or more | The item is minted, the price is burned, and any excess is returned as change |
| The mint itself fails (supply gone since the order, a node hiccup) | The full payment is returned, reason names the failure, and the order is dropped |

**Idempotency is `order.settling = true`, set before the mint is awaited.** A second arrival against the same order sees `settling` and is returned rather than risking a second mint for one order. The order record is deleted only once delivery is confirmed or has definitively failed — never before, because the order is the only description this server has of what a debt is owed for.

**The burn is real.** `coins.burn(order.price)` destroys the coins rather than pooling them at the issuer, and the test below asserts circulating supply falls by exactly the price. This is the only sink in the game.

## The player finds out

A purchase is a transfer the browser signs and then an issuer block it has no part in — nothing pushes a settlement result to the client. `purchases()` is the only channel back, and it answers the proven session's own receipts, newest last:

```ts
purchases(session, origin) {
  // The proven wallet's own, and nobody's else's: a receipt names what
  // somebody paid and what they were given, which is not a thing a session
  // gets to ask about another address.
  const { address } = sessions.require(session, origin)
  return shop.purchases(address)
}
```

```ts
// src/economy.ts — follow(id), polling after a transfer
for (let attempt = 0; attempt < PURCHASE_TRIES; attempt++) {
  await new Promise((resume) => setTimeout(resume, PURCHASE_POLL_MS)) // 700ms, up to 30 tries
  const { purchases } = await withSession((session) => post('/game/purchases', { session }))
  const receipt = purchases?.find((r) => r.id === order.id)
  if (!receipt || receipt.state === 'open') continue // gone from memory, or still settling
  tell(purchaseMessage(receipt), purchaseTone(receipt), 'shop')
  break
}
```

Each receipt (`shared/purchase.ts`) carries a `state` of `'open' | 'delivered' | 'returned'` — there is no `failed`, because the shop's guarantee is that a failure to deliver *is* a return, and it is described as one — plus `paid`, `returned`, an optional `reason`, and the item's name rather than its asset id, because a player is not shown a hex string where a name exists. `purchaseMessage(receipt)` turns that into the one sentence a player reads, and it is deliberately distinguishable: "arrived", "arrived, with change back", "your coins came back: `<reason>`", and "still waiting" are four different things on screen.

## State and errors

| State | Where it lives | Lifetime |
| --- | --- | --- |
| Open orders | `orders`, a `Map<address, Order>` inside `openShop()` | In memory, `ORDER_TTL_MS` = 120s, gone on restart |
| Receipts | `receipts`, a `Map<address, PurchaseReceipt[]>` | `RECEIPT_TTL_MS` = 10 minutes, last 8 kept per address |
| Coin balances | The chain | Permanent |
| Owned upgrades | The chain, as items | Permanent — this is the save file |

Errors from the shop are `GameError`, surfaced by `server/api.ts` as `{ error }` and shown to the player verbatim rather than replaced with "something went wrong":

| Condition | What the player is told |
| --- | --- |
| Unknown sku | `The shop does not sell "a-second-house".` |
| Cannot afford it | `Golden Button Cap costs 6000 coins and you have 0. Press the button a few more times.` |
| Sold out, and nobody's order will free it soon | `The Golden Button Cap is sold out. There is only one on this network and it is owned. Nothing was charged.` |
| Sold out, but an unsettled order might free a copy | `Somebody is paying for the last Golden Button Cap right now. Try again in a minute — nothing was charged.` |
| No session | `That request carried no session. Prove your address first.` |
| Non-JSON request body | `That request was not JSON.` |

## Security boundaries

- **The game server never holds a player key.** It cannot spend a player's coins, and a purchase it wanted to force would require a signature it does not have.
- **The client gate is a courtesy.** `purchaseBlock()` produces a better message; the on-chain balance and supply reads on the server are the checks that matter, and the chain's own transfer rules are the check under that.
- **Affordability is graded on confirmed coins only.** Nothing clearing has ever made a row buyable, on either side.
- **The issuer seed is the whole trust boundary.** It lives in `server/game.ts`, which is why that file cannot run in a browser (SPEC §6.3).
- **Orders and receipts are session-bound, not address-in-body.** `game.order()` and `game.purchases()` both take the address from `sessions.require()`, never from the request — a caller cannot place an order for, or read the receipts of, an address it has not proven it holds. This is the property Button's session work (issue #10 and its follow-ups) added across every rewarding and money-adjacent route, the shop included.
- **A payment the shop cannot account for always comes back.** There is no branch in `settle()` that keeps coins and delivers nothing — every path ends at a mint-and-burn or a `returnTo`, and `returnTo` writes the receipt only after the refund transfer itself resolves, so a browser polling mid-refund never reads an ending that has not actually happened yet.

## Local and mock transport versus a public network

Everything on this page runs today against the in-memory mock. What changes on a persistent public network is not the protocol — it is what the protocol is allowed to assume.

| | Local / mock (what ships) | Persistent public network |
| --- | --- | --- |
| Chain | `MockNode` at `/rpc`, same process, dies with it | A real node; `/rpc` points at it and the two-signature shape is unchanged |
| Issuer identity | Seed generated per run unless `KEI_GAME_SEED` is set — new asset ids each start | Must be a fixed, funded, backed-up seed. New asset ids would orphan every item players own. |
| Funding | `kei.faucet(needed)` covers the issuance burn. The nth asset an account issues burns n Kei, so one currency plus five upgrades is `1+2+3+4+5+6` = 21 Kei. | No faucet on mainnet. Somebody funds the issuer address once, by hand. |
| Order and receipt state | In-memory `Map`s, lost on restart | Needs durable storage, or reconciliation from chain history, before a restart can be survivable |
| Supply-1 items | The Golden Button Cap can be sold once; on a fresh mock it is fresh again | Once, network-wide, forever |

The parts that need no change: the order/transfer/verify/settle sequence, the burn, the refund-or-deliver guarantee, and the fact that the player signs their own payment. The parts that do are all bookkeeping durability on the server's side of the line.

## Tests

```sh
bun test test/api.test.ts
```

`describe('the shop answers for itself')` in `test/api.test.ts` drives the whole protocol over both front doors — the Bun dev server and the deployed Worker's router — through the same requests a browser sends:

```ts
// test/api.test.ts
const session = await authenticate(arena)
await pressThrough(arena, session, 30)
const { body: paid } = await arena.door('/game/bank', { session, batch: batchId() })
await arena.player.claims.add(paid.bundle)

const { body: order } = await arena.door('/game/order', { session, sku: 'glove' })
const open = await arena.door('/game/purchases', { session })
expect(open.body.purchases.at(-1)).toMatchObject({ id: order.id, state: 'open' })

const coins = await arena.player.token(arena.game.catalogue().coin.asset)
await coins.transfer(order.to, order.price)
// ...poll /game/purchases...
expect(settled).toMatchObject({ state: 'delivered', item: 'Springy Glove' })
```

| Test | What it pins down |
| --- | --- |
| `a purchase can be followed to its ending through the door` | Order → pay → poll `/game/purchases` → `delivered`, end to end over HTTP |
| `receipts need a session, because they are about somebody's money` | `/game/purchases` refuses a bare address with no proof |

## Continue

- [Button](../button.md) — the whole example, and where the shop sits in it.
- [Player rewards](./player-rewards.md) — the session and observation protocol every route on this page depends on, plus the earning side of the same wallet.
- [Button fundamentals](./fundamentals.md) — the press → bank → commit → claim loop the coins come from, as a runnable script.
- [Batch rewards reference](../../reference/claims.md) — the `commit` and `claim` API on the earning side.
- [Integration model](../../guide/integration.md) — the two halves and the signing boundary, without a game around them.
