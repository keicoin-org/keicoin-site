import { describe, expect, test } from 'bun:test'

import {
  GRANT_BURST,
  GRANT_COOKIE,
  GRANT_REFILL_MS,
  GRANT_TTL_MS,
  grantCookie,
  mintGrant,
  readCookie,
  readGrant,
  spendWorkToken,
  verifyTurnstile,
  type Bucket,
} from './work-grant.js'

const SECRET = '0x4AAAAAAA-not-a-real-turnstile-secret'

describe('grants', () => {
  test('a minted grant reads back, and nothing else does', async () => {
    const now = Date.now()
    const grant = await mintGrant(SECRET, now)

    expect(await readGrant(SECRET, grant.token, now)).toEqual({ id: grant.id, expiresAt: grant.expiresAt })
    expect(grant.expiresAt).toBe(now + GRANT_TTL_MS)

    // Every way of not having one.
    expect(await readGrant(SECRET, null, now)).toBeNull()
    expect(await readGrant(SECRET, '', now)).toBeNull()
    expect(await readGrant(SECRET, 'garbage', now)).toBeNull()
    expect(await readGrant('a different secret', grant.token, now)).toBeNull()
    expect(await readGrant(SECRET, grant.token, grant.expiresAt)).toBeNull()
    expect(await readGrant(SECRET, grant.token, grant.expiresAt + 1)).toBeNull()
  })

  test('the signature is over the expiry, so extending a grant invalidates it', async () => {
    const now = Date.now()
    const grant = await mintGrant(SECRET, now)
    const [id, , signature] = grant.token.split('.')

    const extended = `${id}.${now + GRANT_TTL_MS * 10}.${signature}`
    expect(await readGrant(SECRET, extended, now)).toBeNull()

    // A signature lifted from one grant onto another id.
    const swapped = `${'b'.repeat(32)}.${grant.expiresAt}.${signature}`
    expect(await readGrant(SECRET, swapped, now)).toBeNull()
  })

  test('the cookie is HttpOnly, Secure, SameSite=Strict and scoped to the work path', () => {
    const cookie = grantCookie('token-value', 900, '/kei/work')
    expect(cookie).toContain(`${GRANT_COOKIE}=token-value`)
    expect(cookie).toContain('Path=/kei/work')
    expect(cookie).toContain('Max-Age=900')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Strict')
  })

  test('the cookie is found among others and missing when absent', () => {
    expect(readCookie(`theme=dark; ${GRANT_COOKIE}=abc; other=1`, GRANT_COOKIE)).toBe('abc')
    expect(readCookie('theme=dark', GRANT_COOKIE)).toBeNull()
    expect(readCookie(null, GRANT_COOKIE)).toBeNull()
    // A prefix of the name must not match it.
    expect(readCookie(`not_${GRANT_COOKIE}=abc`, GRANT_COOKIE)).toBeNull()
  })
})

describe('the token bucket', () => {
  test('a burst of simultaneous requests spends the burst rather than refilling it', () => {
    // This is the regression keicoin-org/kei-transaction#153 found twice: a
    // refill computed per request instead of per elapsed millisecond makes the
    // cap scale with the request rate. Every request here shares one `now`.
    const now = Date.now()
    let bucket: Bucket | undefined
    let allowed = 0

    for (let attempt = 0; attempt < GRANT_BURST * 5; attempt++) {
      const result = spendWorkToken(bucket, now)
      bucket = result.bucket
      if (result.allowed) allowed++
    }

    expect(allowed).toBe(GRANT_BURST)
    expect(bucket?.tokens).toBe(0)
  })

  test('refusal names how long to wait, and waiting that long works', () => {
    const now = Date.now()
    let bucket: Bucket | undefined
    for (let attempt = 0; attempt < GRANT_BURST; attempt++) bucket = spendWorkToken(bucket, now).bucket

    const refused = spendWorkToken(bucket, now)
    expect(refused.allowed).toBeFalse()
    expect(refused.retryAfterMs).toBe(GRANT_REFILL_MS)

    expect(spendWorkToken(bucket, now + GRANT_REFILL_MS - 1).allowed).toBeFalse()
    expect(spendWorkToken(bucket, now + GRANT_REFILL_MS).allowed).toBeTrue()
  })

  test('an idle bucket refills to the burst and no further', () => {
    const now = Date.now()
    const drained: Bucket = { tokens: 0, updatedAt: now }
    const afterAnHour = spendWorkToken(drained, now + 3_600_000)

    expect(afterAnHour.allowed).toBeTrue()
    expect(afterAnHour.bucket.tokens).toBe(GRANT_BURST - 1)
  })

  test('a clock that goes backwards does not mint allowance', () => {
    const now = Date.now()
    const bucket: Bucket = { tokens: 1, updatedAt: now }
    const result = spendWorkToken(bucket, now - 60_000)
    expect(result.allowed).toBeTrue()
    expect(result.bucket.tokens).toBe(0)
  })
})

describe('Turnstile verification', () => {
  const siteverify = (body: unknown, status = 200): typeof globalThis.fetch =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof globalThis.fetch

  test('a token Cloudflare accepts is accepted', async () => {
    const outcome = await verifyTurnstile({ secret: SECRET, token: 'solved', fetch: siteverify({ success: true }) })
    expect(outcome).toEqual({ ok: true, reason: 'ok' })
  })

  test('the client IP is forwarded and the secret is never put in the URL', async () => {
    let seenUrl = ''
    let seenIp: unknown
    const capture = (async (url: string, init: RequestInit) => {
      seenUrl = url
      seenIp = (init.body as FormData).get('remoteip')
      return new Response(JSON.stringify({ success: true }))
    }) as unknown as typeof globalThis.fetch

    await verifyTurnstile({ secret: SECRET, token: 'solved', ip: '203.0.113.7', fetch: capture })
    expect(seenIp).toBe('203.0.113.7')
    expect(seenUrl).not.toContain(SECRET)
  })

  test.each([
    [{ success: false, 'error-codes': ['timeout-or-duplicate'] }, 200, 'timeout-or-duplicate'],
    [{ success: false, 'error-codes': ['invalid-input-response'] }, 200, 'invalid-input-response'],
    [{ success: false }, 200, 'rejected'],
    [{}, 500, 'siteverify-http-500'],
  ])('%j at %i is refused as %s', async (body, status, reason) => {
    const outcome = await verifyTurnstile({ secret: SECRET, token: 'x', fetch: siteverify(body, status) })
    expect(outcome).toEqual({ ok: false, reason })
  })

  test('an empty token is refused without asking Cloudflare', async () => {
    let called = false
    const never = (async () => {
      called = true
      return new Response('{}')
    }) as unknown as typeof globalThis.fetch

    expect(await verifyTurnstile({ secret: SECRET, token: '', fetch: never })).toEqual({
      ok: false,
      reason: 'missing-input-response',
    })
    expect(called).toBeFalse()
  })

  test('an unreachable siteverify fails closed', async () => {
    const down = (async () => {
      throw new Error('network')
    }) as unknown as typeof globalThis.fetch

    expect(await verifyTurnstile({ secret: SECRET, token: 'x', fetch: down })).toEqual({
      ok: false,
      reason: 'siteverify-unreachable',
    })
  })
})
