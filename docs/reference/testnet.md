---
title: Public testnet proof
description: Run the mock-free proof against https://testnet.keicoin.org/rpc and see which error codes the real node returns.
---

# Public testnet proof

## Outcome

Every other playground on this site runs against `Kei.mock()`, and every one of
them says so under its own "what the mock proves" heading. This page is the one
that uses the network. It publishes real blocks to
`https://testnet.keicoin.org/rpc` and asserts what that node returns — which on
the claims refusal paths is **not** what the mock returns.

Read this page before you write control flow against `KeiError.code`.

## Run the live proof

```sh
bun install --frozen-lockfile
bun run docs/playgrounds/testnet-live.ts
```

**This playground needs the network.** It is deliberately not in the site's
`bun test` set, which stays offline; every other playground here runs with the
network unplugged.

Captured from a real run on 4 August 2026, against
`https://testnet.keicoin.org/rpc` (`node_vendor` `Banano V25.1`, `network`
`dev`, `build_info` `a0c91e1f`, reported by the node's own `version` action), on
`kei-transaction@0.8.0`:

```json
{"kind":"testnet-live","node":"https://testnet.keicoin.org/rpc","network":"testnet","claimRoot":{"published":true,"count":2,"claimed":7,"closed":true},"refusals":{"duplicateClaim":"node-error","closedRoot":"node-error","secondAccept":"offer-taken","paymentMemo":"no-memo-yet"},"swap":{"price":3,"buyerOwnsItem":true,"buyerKei":7,"sellerKei":8}}
```

The accounts, root, item and offer are new on every run, so the hashes differ
and the summary above does not. The run exits nonzero on any failed assertion.

<<< ../playgrounds/testnet-live.ts

## The one thing the mock gets wrong

`Kei.mock()` refuses a bad ledger write with a granular code —
`already-claimed`, `root-closed`, `bad-proof`, `insufficient-balance`. Those
codes are produced by the in-process mock ledger in `@keicoin/core`. **The public
node does not send them.** A write the node refuses comes back as
`node-error`, and the distinction is in `KeiError.message`, in the node's own
words:

| Attempt | `Kei.mock()` code | `https://testnet.keicoin.org/rpc` |
| --- | --- | --- |
| Claim twice from one root | `already-claimed` | `node-error` — *"This account has already claimed from that root"* |
| Claim from a closed root | `root-closed` | `node-error` — *"That commit root is closed and accepts no further claims"* |
| Claim with a tampered amount | `bad-proof` | `node-error` — *"That proof does not lead from this account, asset and amount to the committed root"* |
| Claim on a bundle re-pointed at an account with no leaf | `bad-proof` | `node-error` — **the same sentence.** The node does not distinguish a wrong proof from a wrong account. |

So `if (error.code === 'already-claimed')` is a branch that runs in your tests
and never runs in production. Handle a refused signed write as `node-error`,
then re-read authoritative state — `commitInfo(root)`, the account chain, the
holding — and decide from what the ledger says rather than from the code.

Refusals raised **client-side**, before a block reaches the wire, are stable
everywhere. The proof above asserts two of them against the live node:
`offer-taken` (from a fresh read of the offer, in `@keicoin/market`) and
`no-memo-yet` (from `@keicoin/core`'s client, which never puts a memo on the
wire because the wire format has no field for one).

## Authority and trust boundary

| Fact | Authority |
| --- | --- |
| Whether a block was accepted | The node's reply to `process`, read back from the account chain. |
| Why a block was refused | `KeiError.message` for a `node-error`; `KeiError.code` only for client-side refusals. |
| Root publication and closure | `commitInfo(root)` on the node, not the SDK's local batch object. |
| Item custody during an offer | The ledger: `items.owner()` is `null` while the offer stands. |
| Offer discovery | The accounts you name. There is no global order book and no indexer. |
| The testnet itself | One rate-limited best-effort dev node with published dev keys, no uptime promise, and no monetary value. |

## Live state transitions

1. `Kei.server()` against the node URL reports `network: 'testnet'` and faucets.
2. `token.commit(entries)` publishes one root; `commitInfo(root)` on the node
   echoes issuer, asset, count, total and `closed: false`.
3. The player's own key writes the claim block. The balance moves.
4. A second claim is refused by the node as `node-error`.
5. `token.close(root)` flips `closed` to `true` on the node; later claims are
   refused as `node-error`.
6. `market.sell()` locks the item at the ledger — `items.owner()` becomes
   `null`, for everyone, including the seller.
7. `market.accept()` moves both legs in one settlement: the item to the buyer
   and the Kei to the seller. The offer's state becomes `accepted`.
8. A second accept is refused client-side as `offer-taken`.

## Failure cases

| Failure | What it means and what to do |
| --- | --- |
| The run fails at `faucet()` | The dev node is rate-limited and best-effort. This is the network, not your integration. Retry later. |
| A signed write times out | Do not resubmit. Re-read the account chain; the node may have accepted the block before the reply was lost. |
| `node-error` on a claim | Re-read `commitInfo(root)` and the account's holding. The message names the cause; the code does not. |
| A code you assert in tests never appears live | Check whether it is a mock ledger code. The table above lists the ones that differ. |
| The summary values move | Only the assertions matter. Hashes and addresses are new every run by design. |

## Screenshot evidence

None. Nothing on this page is a visible UI state; a capture would be decorative
rather than evidence. The reproducible artifact is the command, its exit status,
and the JSON above, recorded with the node version string it ran against.

## What the public testnet proves

It proves that the released SDK publishes accepted blocks to a real node over
the public URL, that a rooted claim and an atomic swap both settle there, and
that the refusal codes differ from the mock's in the way tabled above.

It does **not** prove production readiness. One node accepting blocks is a
working API, not distributed consensus. There is no mainnet. Nothing on Kei holds
value today, this network has published dev keys and no uptime promise, and its
state may be discarded without notice.

::: warning Pre-release network
The public testnet is one rate-limited, best-effort dev node with weak consensus,
no uptime promise, published dev keys, and no monetary value. Do not ship a
production economy on it.
:::
