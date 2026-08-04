---
title: Future pool design (proposal)
description: A proposal for pump-style pooled trading in Carpet Markets — what it would take, why @keicoin/market cannot do it today, and the two routes.
---

# Future pool design (proposal)

::: danger This is a proposal, not documentation
Nothing on this page exists. There is no pool, no curve, and no quote endpoint in
`@keicoin/market`, and none of the calls sketched here are real API. For what
ships today, read [Market API](./api.md) and [Offer lifecycle](./offer-lifecycle.md).
Treat every code block below as a sketch of a shape somebody would have to build.
:::

## Status

**Proposed. Not scheduled, not designed at the ledger, not implemented.** The
SPEC carries this as explicit backlog in §9.5, which reaches the same two routes
this page does and says the part worth reading first: the request keeps arriving
"in a shape that sounds small and is not." It sits behind all four active tracks
(SPEC §13) and behind whatever the public testnet needs. It also runs against a
standing non-goal: SPEC §3 rejects an "on-chain exchange, AMM, or order book,"
and §9.4 says the chain moves and records assets rather than pricing them.
Nothing here can ship without that decision being deliberately revisited and the
SPEC amended in the open. This page exists so the amendment argument is written
down, not so the feature is assumed.

## Goal

Carpet Markets is repeatedly asked for the interaction people know from pump.fun:
you land on a coin page, type an amount, and see what you get — instead of
scrolling a list of other people's offers hoping one is the size you want. That
request is about *interface*, and the interface is worth taking seriously even
though the mechanism behind it on Solana is not one Kei has or wants.

The goal, stated narrowly: **let a player trade against a visible quoted pool
rather than hunting for a bilateral counterparty, without a server ever holding
their coins and without inventing a smart contract VM.**

## Player experience

The proposed loop, end to end:

1. **Create a coin, then seed a pool.** Launch is what it is today — name, symbol,
   transfer policy, one flat burn. The new step is optional and explicit: the
   creator commits some of their supply and some Kei as the pool's opening
   reserves. A coin with no pool still works exactly as it does now, as an offer
   book.
2. **Enter an amount, not a counterparty.** Buy box: "spend 12 KEI" → "receive
   ≈ 4,180 WOOL." Sell box mirrors it. The quote is derived from the pool's
   current reserves by a stated rule, and the rule is printed on the page.
3. **See the price impact before confirming.** Large orders against small reserves
   move the price a lot. Show the impact percentage next to the quote, and make
   it loud rather than a tooltip — the whole editorial line of this repo is that
   the uncomfortable number goes in the big type.
4. **Set slippage and a minimum received.** The quote is read at time T and the
   block lands later. The player picks a tolerance; the transaction carries a
   `minReceive`, and it fails rather than filling at a worse number.
5. **Watch the transaction actually settle.** Submitted → accepted by consensus →
   balance updated, with the block hash shown, on the **real configured network**
   (SPEC §6.7 `network: 'testnet' | 'mainnet'`). No optimistic UI that shows a
   fill the ledger never accepted.
6. **Read history off settled blocks**, as now. A pool trade is a settled block
   like any other, so `price()` keeps meaning "what actually happened."

### Visual inspiration versus Solana mechanics

The visual reference is [cutupdev/Solana-Pumpfun-Frontend](https://github.com/cutupdev/Solana-Pumpfun-Frontend),
a public Next.js + TypeScript + Tailwind pump.fun-style **frontend scaffold**. Its
README describes wallet connection, image upload via Pinata, metadata on IPFS,
token launch and swap through Solana program calls, and a trading chart. Its own
README says the complete contract and backend code are not in the public repo.

What is being borrowed and what is not:

| Borrowed | Not borrowed |
|---|---|
| The buy/sell amount box as the primary control | Solana programs, Anchor, or any on-chain VM |
| A quote and price impact shown before confirming | Bonding-curve-with-graduation-to-a-DEX as a mechanic |
| Slippage tolerance as a first-class setting | IPFS/Pinata metadata (coin art here is derived from the asset id) |
| Transaction status surfaced as a real state machine | Any performance, liquidity, or safety claim from that project |

No claim in that README is repeated as a claim about Kei, and none of its code or
mechanics are ported. Kei has no smart contract VM and is not getting one
(SPEC §3, and §18 carries it as settled) — so anything below that resembles a "pool" has to be a ledger
primitive or an off-chain service, and those are the two routes in this document.

## Pool semantics

The properties a proposal has to pin down before anyone writes code:

- **What a pool is.** A named pair — one asset, one Kei side — with reserves, an
  owner who seeded it, and a quoting rule. It is a record, not a program.
- **The quoting rule is fixed and stated, not programmable.** A single constant-
  product-style rule chosen once at the protocol level, with parameters, is the
  only version compatible with "no VM." A per-pool user-supplied formula is a VM
  with extra steps, and is out of scope.
- **Who may seed and who may withdraw.** Simplest defensible answer: the seeding
  account, and only that account, can add or withdraw reserves — and withdrawal
  is visible on-chain, so "the creator pulled the reserves" is a readable event
  rather than a rumour. This repo's whole argument is that the badge tells the
  truth; a withdrawable pool must be labelled as such.
- **Fees.** Whether a trade fee accrues to the pool, to the seeder, or nowhere.
  Default proposal: nowhere in v1 of the feature. A fee is a revenue design and
  drags in questions this page should not answer.
- **Interaction with `transfer` policy.** `issuer-only` and `none` assets must be
  un-poolable for the same reason they are un-offerable today, and that has to be
  enforced at the ledger, not in the UI.
- **Coexistence with offers.** A pool does not replace `swap_offer`. Both can
  exist for the same asset; the page shows both, and the pool is not privileged.

## Network and discovery

**Discovery stays address- and registry-scoped.** Kei ships no network-wide
listing index (SPEC §9.1), and `offers()` requires `from` on purpose. A pool does
not change that, and SPEC §9.5 says so directly: finding pools stays explicit, by
registry or account-scoped read, unless the no-global-indexer decision is
reopened as its own separate question. A pool would live on some account's chain,
and finding pools would still
mean reading the accounts your app knows about — in Carpet Markets, the registry's
list.

This page makes **no claim of a global indexer**, and any implementation that
quietly needs one to work is disqualified by that fact alone. "All pools on the
network" is an indexer. If a future SPEC deliberately changes the discovery model,
that is its own decision with its own document; until then, a pooled coin nobody
told the registry about is invisible here, settles fine, and that is the same
known limit the offer book already has.

Everything runs against the configured network — mock, testnet, or mainnet — and
the UI must name which one, since the hosted Carpet Markets deliberately runs a
throwaway in-memory chain.

## Required protocol work

Nothing in `@keicoin/market` can do this today, and the gap is not a wrapper.

The current API is `sell` / `bid` / `offer` / `accept` / `cancel`, plus
`offers` / `mine` / `trades` / `price`. Every one of those is bilateral: an offer
*is* a `swap_offer` block that locks **the offerer's own asset**, and a settlement
*is* one `swap_accept` block that moves both legs (SPEC §9.2, §9.3). Consequences:

- There is no counterparty that is not an account with a signing key. A "pool"
  that anyone can trade against on demand has no signer at the moment of the
  trade.
- There is no quote. `price()` summarises **settled** blocks and returns `null`
  for an asset nobody has traded — it is history, not an offer to deal.
- There is no partial fill. An offer settles once, entirely, and a buyer takes
  the seller's chosen size or nothing.
- There is no slippage or `minReceive` field anywhere in the block format.
- Expiry is advisory and the chain has no clock (SPEC §9.3), so no deadline-based
  protection exists to lean on.

So a real pool needs, at minimum: a new block type (seed/trade/withdraw), a
consensus rule that computes the fill from reserves and rejects it if it violates
the caller's `minReceive`, ledger state for reserves, SDK surface, node
implementation, and a testnet rollout. That is protocol work, not SDK work.

## Security choices

Two routes. They are not close in kind.

### Route A — a server-operated reserve and quote account

The registry (or a sibling service) holds a Kei balance and a coin balance, quotes
a price over HTTP, and settles each trade as an ordinary two-sided transaction
with the player.

- **Feasible today.** No SPEC change, no node change. It could be built in the
  existing architecture.
- **It makes the server the counterparty to every trade.** That is custody, and it
  is the exact thing SPEC §4's "does it need consensus or custody" test, §5.2, and
  §6.4 refuse — and it is what this repo already removed once and wrote up in
  [There is no curve, deliberately](../carpet-markets.md#there-is-no-curve-deliberately).
- **Availability becomes a trust assumption.** If the service is down, drained, or
  lying, the quote is worthless and the reserves are its own. Players hold a claim
  on an operator, not a balance on a ledger.
- **The price stops being a price.** It becomes the operator's formula, which is
  the specific dishonesty the current design was built to avoid.

Route A is written down here to be rejected explicitly, not as a fallback to reach
for under deadline. If it is ever built, it must be labelled as a custodial
service on every screen it touches.

### Route B — a protocol-native pool primitive enforced by Kei nodes — preferred

A new transaction type in the ledger. Reserves are consensus state; the fill is
computed by the node from the reserves under the fixed rule; a trade block that
would deliver less than the caller's `minReceive` is an **invalid block**, not a
bad outcome.

- **Non-custody is preserved.** No operator ever holds a player's coins, and a
  bad or absent server cannot cost anybody a balance.
- **This is not a smart contract.** It is one more native transaction type with a
  fixed rule, in the same family as `swap_offer` — no VM, no user-supplied code,
  no gas. That distinction is the whole reason it is even arguable under SPEC §3,
  and it is also exactly the boundary that a "native token primitive must not grow
  into a VM" warning exists to guard. If the design starts needing per-pool logic,
  the answer is no.
- **The cost is real:** SPEC amendment, ledger and block-format work, `kei-node`
  C++ implementation (consensus-critical, slow cadence by design), conflict rules
  against concurrent trades on one pool, SDK surface, and a testnet cycle before
  anybody's coin depends on it.

Route B is preferred on the condition that non-custody is maintained. It is not
preferred on schedule.

## Migration plan

Staged, and every stage is after higher-priority work — this queues behind all
four active tracks (SPEC §13) and a stable public testnet.

1. **Decide, in the SPEC.** An amendment that either admits a pool primitive as an
   exception to §3 with stated bounds, or closes the question. Nothing else starts
   until this lands. Route A is not a substitute for this step.
2. **Design the block format and conflict rules.** Seed, trade, withdraw; reserve
   state; the fixed quoting rule; interaction with `transfer` policies and with
   existing `swap_offer` locks; what happens when two trades hit one pool in the
   same instant.
3. **Mock ledger first.** Implement in `Kei.mock()` and in `@keicoin/market`
   behind an explicit opt-in, so the UX can be built and tested with no node.
4. **Node implementation and testnet.** `kei-node` gains the type; testnet runs it
   under load before any documentation says it exists.
5. **Carpet Markets adopts it as a second mode.** The offer book stays. A coin
   page shows both, and coins without a pool are unchanged.
6. **Documentation flips.** This page stops being a proposal and becomes a guide —
   or is deleted with a note saying the question was closed.

## Acceptance criteria

A stage is not done because it demoed. Concretely:

- A pool can be seeded and its reserves read back off the chain by a client that
  asked no server anything except for the account list.
- A buy of size N returns exactly the amount the node computes from reserves, and
  the client's pre-trade quote matches the settled result whenever reserves did
  not change in between.
- A trade whose fill would be below `minReceive` is **rejected by the ledger**, and
  the test asserts it against the mock ledger and a real node, not in the UI.
- Price impact shown in the UI is derived from the same rule the node applies, and
  a test asserts the two agree for a spread of sizes including one that moves the
  pool by more than half.
- A pooled asset with `transfer: 'issuer-only'` or `'none'` cannot be seeded or
  traded — an invalid block, asserted at the ledger, the same way
  `test/registry.test.ts` asserts the soulbound claim today.
- Two concurrent trades against the same pool both resolve deterministically: both
  settle at their own computed prices, or one fails cleanly, and the test asserts
  the chain rather than which promise threw.
- No code path requires enumerating pools the caller was not told about. A
  reader with the same account list gets the same answer.
- The UI names the configured network and shows a settled block hash before it
  claims a trade happened.
- Bilateral offers still work unchanged, with the existing test suite green.
- Every claim on the resulting page is backed by a test, or it is not on the page.

## Open decisions

- Does SPEC §3's rejection of an "AMM or order book" get amended, bounded, or
  upheld? Everything else is downstream of this, and §9.5 sets the bar for even
  asking: name the feature that is impossible without a pool, rather than wanting
  the interface that usually sits on one.
- Is a withdrawable pool honest enough to ship, or does the seeder have to be
  locked in — and if locked in, for how long, on a chain with no clock?
- One fixed quoting rule for the whole network, or parameters per pool? Anything
  more expressive than parameters is a VM.
- Fees: none, or accruing to whom?
- What happens to a pool whose seeding key is lost — the same "burn with a
  tombstone" outcome as an abandoned offer (SPEC §9.3), or something worse because
  reserves are larger?
- Does the registry need to list pools at all, or does the existing account list
  cover it?
- Does this belong in Carpet Markets — a satire of a pattern that has taken real
  money from real people — or does building the comfortable version of that
  pattern undercut the point the demo is making?

## Related guides

- [Market API](./api.md) — what `@keicoin/market` actually does today.
- [Offer lifecycle](./offer-lifecycle.md) — the bilateral flow this proposal would sit beside, not replace.
- [Carpet Markets](../carpet-markets.md) — the demo, and [why the curve was removed](../carpet-markets.md#there-is-no-curve-deliberately).
- [Tokens reference](../../reference/tokens.md) — `transfer`, `swap`, and what issuance costs.
