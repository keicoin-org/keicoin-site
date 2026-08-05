/**
 * Who may spend this Worker's CPU on proof-of-work.
 *
 * `worker/index.ts` answers `CLICK_WORK_PATH` with `@keicoin/work`'s
 * `workRpcHandler`, which is the right handler and the wrong trust model for a
 * public origin: its only optional gate is a bearer token, and the caller is a
 * browser page. `Kei.start({ workServer })` builds its `WorkServerProvider`
 * through `createWorkProvider`, which passes no `headers`, so the homepage
 * clicker cannot send an `Authorization` header at all. A token would have to be
 * in the bundle, where it is not a token.
 *
 * So the gate is per-IP instead, and it is deliberately shaped so that the
 * refusal is what happens by default:
 *
 *   - **No limiter bound, no work.** If `WORK_RATE_LIMIT` is missing from `env`
 *     — a stripped `wrangler.jsonc`, a preview environment that did not inherit
 *     the binding, a `wrangler dev` without it — this refuses every request
 *     rather than serving an ungated one. Losing the binding must not silently
 *     reopen the faucet.
 *   - **No client IP, no work.** `CF-Connecting-IP` is set by the edge on every
 *     request that reaches a deployed Worker. Its absence means this is not
 *     running where the key can be trusted, so there is nothing to key on.
 *   - **Tier A is refused outright.** The clicker sends `send` blocks (tier B)
 *     and receives the faucet (tier C). Tier A is `issue`/`mint`/`commit`
 *     (SPEC §5.6.4) — the most expensive search this service can perform, and
 *     nothing the homepage ever asks for. Accepting it from an arbitrary caller
 *     buys the site nothing.
 *
 * Every one of those refusals lands before `generateWork` is entered, because
 * entering it is the cost: it is a synchronous non-yielding blake2b loop
 * (`@keicoin/core`'s work.ts) sharing one isolate with every page on the site.
 *
 * A refused press is not a broken press. `createWorkProvider` passes
 * `fallback: new LocalWorkProvider(node)`, and `WorkServerProvider.generate`
 * treats any non-2xx as unreachable, so a rate-limited visitor generates work in
 * their own tab — slower, which is the point, and the same thing that would
 * happen if this Worker were not deployed.
 */

import { MAX_WORK_REQUEST_BYTES } from '@keicoin/work'

/**
 * The subset of Cloudflare's rate-limiting binding this uses. Declared here
 * rather than imported so the gate can be tested against a plain object.
 */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export interface WorkGateEnv {
  /** `ratelimits` in wrangler.jsonc. Absent means the endpoint is closed. */
  WORK_RATE_LIMIT?: RateLimiter
}

/**
 * Tiers the homepage clicker actually asks for: `send` is B, the faucet receive
 * is C. Anything else is refused before any work is attempted.
 */
export const ALLOWED_WORK_TIERS: readonly string[] = ['B', 'C']

export type WorkGateVerdict =
  | { readonly ok: true; readonly request: Request }
  | { readonly ok: false; readonly response: Response }

function refuse(status: number, error: string): WorkGateVerdict {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error }), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  }
}

/**
 * Decides whether a request to the work endpoint gets to reach the work server.
 *
 * On `ok`, returns a replacement `Request` carrying the body this already read —
 * the original's stream is spent, and `workRpcHandler` reads the body itself.
 */
export async function gateWorkRequest(request: Request, env: WorkGateEnv): Promise<WorkGateVerdict> {
  // Not a work request at all. `workRpcHandler` answers 405 without generating
  // anything, so there is nothing here to gate and no quota to spend on it.
  if (request.method !== 'POST') return { ok: true, request }

  const limiter = env.WORK_RATE_LIMIT
  if (!limiter) return refuse(503, 'the work server is not accepting requests')

  const ip = request.headers.get('cf-connecting-ip')
  if (!ip) return refuse(403, 'the work server is not accepting requests')

  const { success } = await limiter.limit({ key: ip })
  if (!success) return refuse(429, 'too many work requests; generate work locally instead')

  const raw = await request.arrayBuffer()
  if (raw.byteLength > MAX_WORK_REQUEST_BYTES) return refuse(413, 'request body is too large')

  // A malformed or unknown-tier body is `workRpcHandler`'s to answer — it has
  // the messages, and none of its refusals reach `generateWork` either. The one
  // judgement made here is the tier cap.
  const body = new TextDecoder().decode(raw)
  let tier: unknown
  try {
    tier = (JSON.parse(body) as { tier?: unknown }).tier
  } catch {
    tier = undefined
  }
  if (typeof tier === 'string' && !ALLOWED_WORK_TIERS.includes(tier)) {
    return refuse(403, `tier ${tier} is not served here; this work server answers tiers B and C`)
  }

  return { ok: true, request: new Request(request.url, { method: 'POST', headers: request.headers, body }) }
}
