---
title: Errors
description: Route stable Kei error codes to retry, refresh, or permanent refusal without replaying writes blindly.
---

# Errors

## Outcome

Handle a `KeiError` by its stable `code` and preserve its actionable message.
The proof exercises three real paths: an injected offline node read, a stale
accepted market offer, and a payment memo the wire format cannot carry.

## Run the error proof

```sh
bun install --frozen-lockfile
bun run docs/playgrounds/errors.ts
# {"kind":"error-categories","actions":{"nodeUnreachableRead":"retry","nodeUnreachableWrite":"refresh","offerTaken":"refresh","noMemoYet":"permanent"},"codes":["node-unreachable","offer-taken","no-memo-yet"]}
```

The offline node uses an injected `fetch` that throws locally. The playground
makes no network request.

<<< ../playgrounds/errors.ts

## Authority and trust boundary

The SDK owns error codes and safe human messages. Application code owns the
operation context: whether a failed call was a read, an unsigned preparation, or
a signed write that may already have landed. A UI cache never overrules a fresh
ledger read.

Do not parse message text to choose control flow. Show it when safe and use the
code for branching.

## Recovery categories

| Category | Examples | Action |
| --- | --- | --- |
| Retry | `node-unreachable` or `node-timeout` during a read | Retry with bounded backoff. |
| Refresh | `offer-taken`, `offer-cancelled`, `offer-changed`, `already-claimed`, `root-closed` | Re-read authoritative state and update the UI/work queue. |
| Permanent refusal | `no-memo-yet`, bad address/amount, immutable policy, insufficient balance | Change the request or obtain a new user decision; repeating it unchanged cannot help. |

A transport error after a **signed write** belongs in refresh/reconciliation,
not automatic retry. The node may have accepted the block before its reply was
lost.

## Error state transitions

1. Catch `unknown` and narrow with `error instanceof KeiError`.
2. Read `error.code` and the operation context.
3. Retry read-only transport failures with a bound, refresh stale or ambiguous
   state, and stop deterministic refusals.
4. Reconcile a signed write by hash/account state before any resubmission.
5. Preserve the SDK message for the player or operator when it contains no
   application secret.

## Preserve the message

```ts
try {
  await kei.send(recipient, 1.2)
} catch (error) {
  if (error instanceof KeiError) {
    showTransactionError(error.message)
    reportCode(error.code)
  }
}
```

Do not replace an actionable SDK error with “Something went wrong.” Do not put
seeds, authorization headers, or complete private request bodies beside it in
logs.

## Failure cases

- Unknown exceptions are not safe to retry automatically. Stop, retain sanitized
  context, and investigate.
- A refresh loop needs a bound; stale state that never converges is an
  operational failure.
- A retry budget is not permission to replay signed writes.
- Application-specific fulfillment must have its own durable idempotency key;
  the SDK cannot make two database grants one grant.

## Package types are authoritative

This documentation demonstrates the current public surface. The installed
package's TypeScript declarations and `KeiError.code` are authoritative for exact
arguments and codes.

## What `Kei.mock()` proves

The market and memo refusals execute against the in-process ledger. The retry
case executes `HttpNode` with a local throwing transport to prove the stable
`node-unreachable` code without I/O. The example proves classification logic,
not network recovery, database rollback behavior, or that every future code
belongs in one of the listed sets. Unknown codes fail closed.
