/**
 * Who the caller is, as opposed to how often they are calling.
 *
 * `src/site/work-gate.ts` (from #47) is the outer gate: a per-IP rate limit, a
 * size cap, and the tier cap. It stays as it landed and it still runs first on
 * anything that gets this far. This file is the part it cannot do.
 *
 * Split out of `worker/index.ts` for the reason `button/worker/router.ts` is
 * split out of its own: the decisions worth testing are the ones a request
 * meets *before* the expensive part, and a test should be able to drive them
 * without a `workerd` in the loop. Nothing here touches a binding.
 *
 * ## Why a Turnstile token, and not an IP, an Origin, or a bundled bearer
 *
 * keicoin-org/kei-transaction#153 makes the argument in the SDK's own words,
 * about the SDK's own rate limiter: a per-key ceiling is worth nothing when
 * keys are free, and shipping one anyway "buys false confidence, which is
 * worse than the current state because the current state is at least visibly
 * wrong".
 *
 * Of the gates available to a static site on Cloudflare:
 *
 * - **Client IP** is one proxy away. A limit keyed on it is worth having —
 *   it is cheap and it bounds a naive loop, which is why #47's is kept — but
 *   it is not an answer to "who may spend this CPU", because anyone can have
 *   as many keys as they have addresses.
 * - **`Origin`/`Referer`** is a header. It stops a naive loop and nothing that
 *   read this comment.
 * - **A bearer token given to the clicker at build time** ships inside
 *   `clicker.js`, which is served to everyone by design.
 * - **A Turnstile token** is issued by Cloudflare, not by us, and siteverify
 *   will not accept the same one twice. It is the only credential on the list
 *   that costs the caller something we did not hand them for free.
 *
 * So: one Turnstile solve buys one grant; a grant is a signed capability with
 * a bounded budget; every work request spends from that budget. An attacker
 * can still get a grant — that is the point, and it costs them a solve per
 * `GRANT_BURST + lifetime/GRANT_REFILL_MS` searches instead of nothing per
 * search.
 *
 * ## Why the grant is signed rather than looked up
 *
 * The budget lives in a Durable Object named after the grant id, so an
 * unsigned cookie would let a stranger spawn a Durable Object per random
 * string they invent. The HMAC means a request that never saw a Turnstile
 * challenge is rejected in the site's own handler, before the Durable Object
 * layer is touched at all.
 *
 * ## The sweep #153 asks for
 *
 * #153 requires an idle sweep so buckets cannot accumulate. Here the bucket is
 * the Durable Object, and it is swept by an alarm at the grant's expiry rather
 * than when it happens to be idle — which is the stricter version of the same
 * rule, and possible only because a fresh key is not free: under #153's model
 * "a fresh key starting full" is correct because the key costs nothing to
 * mint, whereas here re-minting costs another challenge.
 */

/** Cookie the grant travels in. `HttpOnly`, so `clicker.js` cannot read it back out. */
export const GRANT_COOKIE = 'kei_work_grant'

/** How long one Turnstile solve stays spendable. */
export const GRANT_TTL_MS = 15 * 60_000

/** Searches a fresh grant may make back-to-back. */
export const GRANT_BURST = 10

/** Sustained rate after the burst: one search per this many milliseconds. */
export const GRANT_REFILL_MS = 2_000

/** A Turnstile token is ~2 KB at the top of its documented range. */
export const MAX_GRANT_REQUEST_BYTES = 8_192

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Domain separation, so a grant signature can never be read as anything else signed with the same secret. */
const GRANT_DOMAIN = 'kei-work-grant-v1'

const encoder = new TextEncoder()

export interface Grant {
  id: string
  expiresAt: number
}

export interface Bucket {
  /** Fractional on purpose — the refill is elapsed-time, not per-request (#153). */
  tokens: number
  updatedAt: number
}

export interface TurnstileCheck {
  ok: boolean
  reason: string
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function signGrant(secret: string, id: string, expiresAt: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toBase64Url(await crypto.subtle.sign('HMAC', key, encoder.encode(`${GRANT_DOMAIN}\n${id}\n${expiresAt}`)))
}

/** Length-independent, so a mismatch does not leak where it stopped matching. */
function equalStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let differences = 0
  for (let index = 0; index < a.length; index++) differences |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return differences === 0
}

/** Issued only after `verifyTurnstile` has said yes. */
export async function mintGrant(secret: string, now: number): Promise<{ token: string } & Grant> {
  const id = crypto.randomUUID().replaceAll('-', '')
  const expiresAt = now + GRANT_TTL_MS
  return { id, expiresAt, token: `${id}.${expiresAt}.${await signGrant(secret, id, expiresAt)}` }
}

/** `null` for anything that is not a live grant this site signed. */
export async function readGrant(secret: string, token: string | null, now: number): Promise<Grant | null> {
  if (!token) return null
  const [id, expiry, signature] = token.split('.')
  if (!id || !expiry || !signature) return null
  if (!/^[0-9a-f]{32}$/.test(id) || !/^[0-9]{1,15}$/.test(expiry)) return null

  const expiresAt = Number(expiry)
  if (expiresAt <= now) return null
  // A grant cannot outlive the TTL it was minted under, so a forged far-future
  // expiry is refused on its face rather than only on the signature.
  if (expiresAt > now + GRANT_TTL_MS) return null

  if (!equalStrings(signature, await signGrant(secret, id, expiresAt))) return null
  return { id, expiresAt }
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== name) continue
    return part.slice(separator + 1).trim() || null
  }
  return null
}

export function grantCookie(token: string, maxAgeSeconds: number, path: string): string {
  // `HttpOnly` because nothing in the page needs to read it and a script that
  // cannot read it cannot leak it. `Strict` because the only caller is the
  // homepage on this same origin.
  return [
    `${GRANT_COOKIE}=${token}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ].join('; ')
}

/**
 * Elapsed-time refill, which is the half both implementations in #153 got
 * wrong by granting a full allowance per request. A fresh bucket starts full
 * because minting the key it is attached to already cost a challenge solve.
 */
export function spendWorkToken(
  bucket: Bucket | undefined,
  now: number,
  burst: number = GRANT_BURST,
  refillMs: number = GRANT_REFILL_MS,
): { allowed: boolean; bucket: Bucket; retryAfterMs: number } {
  const previous = bucket ?? { tokens: burst, updatedAt: now }
  const elapsed = Math.max(0, now - previous.updatedAt)
  const tokens = Math.min(burst, previous.tokens + elapsed / refillMs)

  if (tokens < 1) {
    return {
      allowed: false,
      bucket: { tokens, updatedAt: now },
      retryAfterMs: Math.ceil((1 - tokens) * refillMs),
    }
  }
  return { allowed: true, bucket: { tokens: tokens - 1, updatedAt: now }, retryAfterMs: 0 }
}

/**
 * Asks Cloudflare whether this token is a real, unspent solve. A token is
 * single-use at siteverify, which is what stops one challenge from being
 * replayed into unlimited grants.
 */
export async function verifyTurnstile(options: {
  secret: string
  token: string
  ip?: string | null
  fetch?: typeof globalThis.fetch
}): Promise<TurnstileCheck> {
  const { secret, token, ip } = options
  if (!token) return { ok: false, reason: 'missing-input-response' }

  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)

  const impl = options.fetch ?? globalThis.fetch
  let response: Response
  try {
    response = await impl(TURNSTILE_VERIFY_URL, { method: 'POST', body: form })
  } catch {
    return { ok: false, reason: 'siteverify-unreachable' }
  }
  if (!response.ok) return { ok: false, reason: `siteverify-http-${response.status}` }

  let outcome: { success?: unknown; 'error-codes'?: unknown }
  try {
    outcome = (await response.json()) as typeof outcome
  } catch {
    return { ok: false, reason: 'siteverify-malformed' }
  }

  if (outcome.success === true) return { ok: true, reason: 'ok' }
  const codes = Array.isArray(outcome['error-codes']) ? outcome['error-codes'].join(',') : 'rejected'
  return { ok: false, reason: codes || 'rejected' }
}
