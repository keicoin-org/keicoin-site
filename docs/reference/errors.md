---
title: Errors
description: Handle Kei SDK errors and preserve actionable messages.
---

# Errors

Kei errors are sentences that state the failed condition and the value that must change.

```text
Not enough Kei — balance is 0.4, tried to send 1.2.
```

## Preserve the message

Show the SDK message when it is safe and relevant to the player or developer. Do not replace an actionable error with a generic “Something went wrong.”

```ts
try {
  await kei.send(recipient, 1.2)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  showTransactionError(message)
}
```

## Correct the cause before retrying

Do not blindly retry deterministic failures such as:

- insufficient balance;
- immutable transfer-policy rejection;
- invalid or reused claim proof;
- browser use of the server-only entry point;
- malformed addresses or asset identifiers.

Retry transport failures only when the operation is safe to repeat. Server-side purchase fulfillment should always be idempotent.

## Package types are authoritative

This documentation describes the intended public surface. The installed package's TypeScript declarations are the source of truth for exact arguments and return types.
