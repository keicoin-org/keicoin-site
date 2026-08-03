---
title: Button NPC shop
description: The shopkeeper purchase protocol in Button — take an order, let the player sign the transfer, verify the arrival on-chain, then mint the item and burn the coins.
---

# Button NPC shop

**By the end of this page you can run Button's shopkeeper purchase end to end and say exactly who signed what: the server quotes a price and records intent, the player's own wallet signs the coin transfer, the server waits for the chain to say the coins landed, and only then mints the upgrade and burns what was paid.**

The shop is the part of [Button](../button.md) where money leaves a player instead of arriving. That makes it the part with a settlement problem: the game cannot sign for a player's wallet, a coin transfer carries no memo, and the item has to be delivered exactly once. This page is that protocol, read off the implementation.

::: warning There is no NPC API
Button has no `npc.*`, no `shop.*` SDK surface, and no nested vendor object. The shopkeeper you click is a mesh in `src/world.ts`; the thing that sells you something is a closure called `openShop()` in `server/game.ts`, exposed as exactly one method — `game.order(address, sku)` — behind exactly one route, `POST /game/order`. "NPC shop" is a description of the fiction, not of an interface. See [Gaps in what exists today](#gaps-in-what-exists-today).
:::

## Before you begin

| | |
| --- | --- |
| SDK | `bun add kei-transaction` |
| Runtime | Bun 1.3. `Kei.server()` holds the issuer seed and refuses to run in a browser. |
| Chain | The in-memory `MockNode`, served at `/rpc` by the same process. Nothing on it survives the process. |
| Seeds | Two. The issuer's, held by `server/game.ts`; the player's, held by the browser. Neither can sign for the other. |
| Coins to spend | Earned by pressing. The shop never sells for Kei — that is the separate exchange desk. |
| Source this was read from | `server/game.ts`, `server/main.ts`, `src/economy.ts` and `test/economy.test.ts` in [the Button repository](https://github.com/keicoin-org/button) |

Start the game with `bun run dev` and press the button until you can afford the 25-coin Springy Glove, or skip the browser entirely and drive `game.order()` from a test — [Tests](#tests) below is that path.

## The flow

![Local Button game showing the green button, reward counter, NPC shop board, shopkeeper, and targets](/img/docs/button-gameplay.png)

*The left board and the shopkeeper are the UI a player clicks. Purchase authority is not in that board — it comes from the receipt-verification flow documented below.*

| Step | Who signs | What it is |
| --- | --- | --- |
| **Quote and record** | Nobody | `POST /game/order` → the server checks the player's on-chain coin balance, records `address → {sku, price}` in memory, and answers with where to pay. |
| **Pay** | The player | `coins.transfer(order.to, order.price)` — the player's own wallet, their own block. |
| **Observe** | Nobody | The issuer's `asset-received` subscription sees the arrival. This is chain state, not a callback the client made. |
| **Deliver** | The issuer | `items.mint(item.id, from)` — the upgrade. |
| **Sink** | The issuer | `coins.burn(order.price)` — the coins spent stop existing. |

**The order is not the purchase.** The order records intent; the arriving transfer is the fact. An order nobody pays for delivers nothing and is dropped after 120 seconds.

## Take an order

The client refuses first, on confirmed coins only, so a player whose headline is inflated by clearing rewards gets told which figure was short instead of an order they cannot pay for. The server is still the authority.

```ts
// src/economy.ts — buy(sku)
const refusal = purchaseBlock(state.coins, upgrade.name, upgrade.price)
if (refusal !== null) {
  state.message = refusal
  changed()
  return
}

const response = await fetch(at('/game/order'), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ address: kei.address, sku }),
})
const order = (await response.json()) as { to?: string; price?: number; error?: string }
if (order.error || !order.to || order.price === undefined) {
  throw new Error(order.error ?? 'The shop did not answer.')
}
```

On the server the quote is a chain read, not a lookup in a balances table:

```ts
// server/game.ts — openShop().order()
async order(address, sku) {
  const upgrade = upgradeBySku(sku)
  const item = items.get(sku)
  if (!upgrade || !item) throw new GameError(`The shop does not sell "${sku}".`)

  const held = await coins.balanceOf(address)
  if (held < upgrade.price) {
    throw new GameError(
      `${upgrade.name} costs ${upgrade.price} coins and you have ${held}. Press the button a few more times.`,
    )
  }

  for (const [who, order] of orders) {
    if (Date.now() - order.at > ORDER_TTL_MS) orders.delete(who)
  }
  orders.set(address, { sku, price: upgrade.price, at: Date.now() })
  return { to: kei.address, price: upgrade.price, asset: coins.id }
}
```

`ORDER_TTL_MS` is 120,000. The sweep is opportunistic — it runs when somebody else orders, not on a timer.

## Pay for it

Two signatures, and no third arrangement:

```ts
// src/economy.ts
// The player signs the payment. The shop signs the delivery.
await coins.transfer(order.to, order.price)
state.message = `Bought ${upgrade.name}. It will arrive in a moment.`
```

Nothing about that transfer says what it is for. It is a coin movement to the issuer's address, which is why the order had to be recorded first.

## Purchase verification and idempotent delivery

The server does not trust the client's word that it paid. It subscribes to arrivals and matches them:

```ts
// server/game.ts — openShop()
const stop = kei.on('asset-received', (arrival) => {
  if (arrival.asset !== coins.id) return
  const order = orders.get(arrival.from)
  if (!order || arrival.amount < order.price) return
  orders.delete(arrival.from)

  void (async () => {
    const item = items.get(order.sku)
    if (!item) return
    await kei.items.mint(item.id, arrival.from)
    // The shop is a sink: coins spent here stop existing, which frees the
    // headroom they took under the cap (SPEC §5.6.6).
    await coins.burn(order.price)
  })()
})
```

Three checks in order, and each one is a real gate:

1. **Right asset.** A Kei payment or some other token is not a shop payment; the exchange desk handles Kei separately via `kei.acceptTopUps()`.
2. **A matching open order,** keyed by the paying address. No order means the coins are not a purchase.
3. **Enough paid.** `arrival.amount < order.price` returns without touching the order, so an underpayment does not consume it.

**Idempotency is `orders.delete(arrival.from)`, and it runs before the `await`.** The delete is synchronous inside the event handler, so a second arrival for the same address finds no order and returns at check 2 — one order yields at most one mint and one burn, however many transfers land.

**The burn is real.** `coins.burn(order.price)` destroys the coins rather than pooling them at the issuer, and the test below asserts circulating supply falls by exactly the price. This is the only sink in the game.

## State and errors

| State | Where it lives | Lifetime |
| --- | --- | --- |
| Open orders | `orders`, a `Map<address, {sku, price, at}>` inside `openShop()` | In memory, 120 s, gone on restart |
| Coin balances | The chain | Permanent |
| Owned upgrades | The chain, as items | Permanent — this is the save file |

Errors from the shop are `GameError`, surfaced by `server/main.ts` as `{ error }` and shown to the player verbatim rather than replaced with "something went wrong":

| Condition | What the player is told |
| --- | --- |
| Unknown sku | `The shop does not sell "a-second-house".` |
| Cannot afford it | `Golden Button Cap costs 6000 coins and you have 0. Press the button a few more times.` |
| Non-JSON request body | `That request was not JSON.` |
| No response at all | `The shop did not answer.` (client-side fallback) |
| Transfer rejected by the chain | The SDK's own sentence, via `say(error)` |

Delivery has no error path. The mint and burn run in a floating `void (async () => …)` with no `catch`, no retry, and no record that the order existed — the order was already deleted. See the gaps below.

## Security boundaries

- **The game server never holds a player key.** It cannot spend a player's coins, and a purchase it wanted to force would require a signature it does not have.
- **The client gate is a courtesy.** `purchaseBlock()` produces a better message; `coins.balanceOf(address)` on the server is the check that matters, and the chain's own transfer rules are the check under that.
- **Affordability is graded on confirmed coins only.** Nothing clearing has ever made a row buyable, on either side.
- **The issuer seed is the whole trust boundary.** It lives in `server/game.ts`, which is why that file cannot run in a browser (SPEC §6.3).
- **Orders are keyed by address, and an address is not authenticated.** Anyone can `POST /game/order` for any address; it only records intent and reads a public balance, so the worst it does is overwrite that address's own pending order. See the gaps.

## Local and mock transport versus a public network

Everything on this page runs today against the in-memory mock. What changes on a persistent public network is not the protocol — it is what the protocol is allowed to assume.

| | Local / mock (what ships) | Persistent public network |
| --- | --- | --- |
| Chain | `MockNode` at `/rpc`, same process, dies with it | A real node; `/rpc` points at it and the two-signature shape is unchanged |
| Issuer identity | Seed generated per run unless `KEI_GAME_SEED` is set — new asset ids each start | Must be a fixed, funded, backed-up seed. New asset ids would orphan every item players own. |
| Funding | `kei.faucet(needed)` covers the `(5 + 1) × 1,000` Kei of issuance burn | No faucet on mainnet. Somebody funds the issuer address once, by hand. |
| Order state | In-memory `Map`, lost on restart | Needs durable storage, or reconciliation from chain history, before a restart can be survivable |
| Delivery failure | Silently dropped | Needs a retry with a record of what was paid for |
| Supply-1 items | The Golden Button Cap can be sold once; on a fresh mock it is fresh again | Once, network-wide, forever. The second sale's mint fails — and today that failure is unobserved. |

The parts that need no change: the order/transfer/verify/mint sequence, the burn, and the fact that the player signs their own payment. The parts that do are all bookkeeping on the server's side of the line.

## Tests

```sh
bun test test/economy.test.ts
```

`describe('the shop')` in `test/economy.test.ts` is the checked statement of everything above, against the same in-process chain the game runs on:

```ts
// test/economy.test.ts — the whole protocol, without a browser
await player.claims.add(await game.bank(player.address, 400))
const order = await game.order(player.address, 'glove')
expect(order.price).toBe(upgradeBySku('glove')!.price)

await coins.transfer(order.to, order.price)
await until(async () => (await player.items.owner(glove.asset)) === player.address, 'the glove to arrive')

// Which is the whole progression system: it is on the chain, not in a save file.
expect((await player.items.ownedBy()).map((item) => item.name)).toContain('Springy Glove')
```

| Test | What it pins down |
| --- | --- |
| `an upgrade is bought with a transfer and delivered as an item` | The four-step protocol, end to end |
| `coins spent in the shop are burned, not banked` | `circulating` falls by exactly `order.price` |
| `buying what you cannot afford says the price and the balance` | The server-side balance gate, and its wording |
| `the shop does not sell things it does not sell` | Unknown skus are refused before any state is recorded |
| `the Golden Button Cap is a supply-one native item` | `maxSupply` is `'1'` on the chain, not a server rule |

Delivery is polled with `until()` rather than awaited, because it is asynchronous by design — nothing in the shop blocks a game loop.

## Gaps in what exists today

These are properties of the current implementation, not of the design. Read them before copying the shape into something that holds real value.

- **No NPC abstraction.** One method, `game.order()`, and one route. A second vendor with different stock would mean a second closure, not a parameter.
- **One open order per address.** `orders.set(address, …)` overwrites. Ordering the knuckle and then the glove leaves only the glove; a transfer of the knuckle's larger price then delivers a glove and burns the glove's price, and the difference stays with the issuer.
- **Overpayment is not refunded.** The check is `arrival.amount < order.price`, so paying more delivers the item, burns only `order.price`, and leaves the excess in the issuer's account.
- **Underpayment is not refunded either.** The arrival is ignored and the coins are simply at the issuer's address; the order stays open until its TTL.
- **Delivery is fire-and-forget.** If `items.mint` throws — a supply-1 item already sold, a node hiccup — the order is gone, the coins are gone, and nothing is logged or retried.
- **Order state does not survive a restart.** A transfer in flight across a restart lands with no matching order and delivers nothing.
- **Orders are unauthenticated.** `POST /game/order` takes any address. It writes only that address's own order slot and reads a public balance, but combined with the overwrite behaviour above, a third party can change which item an address's next payment buys.

## Continue

- [Button](../button.md) — the whole example, and where the shop sits in it.
- [Button fundamentals](./fundamentals.md) — the press → bank → commit → claim loop the coins come from, as a runnable script.
- [Batch rewards reference](../../reference/claims.md) — the `commit` and `claim` API on the earning side.
- [Integration model](../../guide/integration.md) — the two halves and the signing boundary, without a game around them.
