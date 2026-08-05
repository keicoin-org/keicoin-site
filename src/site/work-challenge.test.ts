import { describe, expect, test } from 'bun:test'

import { CLICK_GRANT_PATH } from './clicker-network.js'
import { RENEW_LEAD_MS, openWorkGrant, renewDelayMs } from './work-challenge.js'

const SITEKEY = '0x4AAAAAAA-not-a-real-turnstile-sitekey'

function stubFetch(routes: { get: Response | Error; post?: Response | Error }) {
  const seen: { method: string; body: string | null }[] = []
  const fetchImpl = (async (_path: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    seen.push({ method, body: (init?.body as string | undefined) ?? null })
    const outcome = method === 'GET' ? routes.get : routes.post
    if (outcome instanceof Error) throw outcome
    if (!outcome) throw new Error('no stub for this method')
    return outcome.clone()
  }) as unknown as typeof globalThis.fetch
  return { fetchImpl, seen }
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('opening a work grant', () => {
  test('a solved challenge is exchanged for a grant, and the page never sees it', async () => {
    const { fetchImpl, seen } = stubFetch({
      get: json(200, { sitekey: SITEKEY }),
      post: json(200, { expiresAt: 1_800_000 }),
    })
    let askedFor = ''

    const outcome = await openWorkGrant(CLICK_GRANT_PATH, {
      fetch: fetchImpl,
      async solve(sitekey) {
        askedFor = sitekey
        return 'solved-token'
      },
    })

    expect(outcome).toEqual({ ok: true, expiresAt: 1_800_000 })
    expect(askedFor).toBe(SITEKEY)
    expect(seen.map(({ method }) => method)).toEqual(['GET', 'POST'])
    // The grant comes back as a cookie; nothing in the body is a credential.
    expect(seen[1]?.body).toBe(JSON.stringify({ token: 'solved-token' }))
  })

  test('an unconfigured endpoint is reported as such and no challenge is drawn', async () => {
    const { fetchImpl, seen } = stubFetch({ get: json(503, { error: 'no Turnstile widget is configured' }) })
    let solved = false

    const outcome = await openWorkGrant(CLICK_GRANT_PATH, {
      fetch: fetchImpl,
      async solve() {
        solved = true
        return 'never'
      },
    })

    expect(outcome).toEqual({ ok: false, reason: 'unconfigured' })
    expect(solved).toBeFalse()
    expect(seen).toHaveLength(1)
  })

  test('a sitekey the endpoint did not send is not guessed at', async () => {
    const { fetchImpl } = stubFetch({ get: json(200, {}) })
    const outcome = await openWorkGrant(CLICK_GRANT_PATH, {
      fetch: fetchImpl,
      async solve() {
        return 'never'
      },
    })
    expect(outcome).toEqual({ ok: false, reason: 'unconfigured' })
  })

  test('a refused or abandoned challenge falls back rather than throwing at the caller', async () => {
    const { fetchImpl } = stubFetch({ get: json(200, { sitekey: SITEKEY }) })

    const threw = await openWorkGrant(CLICK_GRANT_PATH, {
      fetch: fetchImpl,
      async solve() {
        throw new Error('The challenge expired.')
      },
    })
    expect(threw).toEqual({ ok: false, reason: 'refused' })

    const empty = await openWorkGrant(CLICK_GRANT_PATH, {
      fetch: fetchImpl,
      async solve() {
        return ''
      },
    })
    expect(empty).toEqual({ ok: false, reason: 'refused' })
  })

  test('a token Turnstile rejects at the server is a fallback, not an error', async () => {
    const { fetchImpl } = stubFetch({
      get: json(200, { sitekey: SITEKEY }),
      post: json(403, { error: 'Turnstile rejected this token: timeout-or-duplicate' }),
    })

    const outcome = await openWorkGrant(CLICK_GRANT_PATH, {
      fetch: fetchImpl,
      async solve() {
        return 'replayed'
      },
    })
    expect(outcome).toEqual({ ok: false, reason: 'refused' })
  })

  test('an unreachable endpoint falls back on either leg', async () => {
    const onDiscovery = await openWorkGrant(CLICK_GRANT_PATH, {
      fetch: stubFetch({ get: new Error('offline') }).fetchImpl,
      async solve() {
        return 'never'
      },
    })
    expect(onDiscovery).toEqual({ ok: false, reason: 'unreachable' })

    const onExchange = await openWorkGrant(CLICK_GRANT_PATH, {
      fetch: stubFetch({ get: json(200, { sitekey: SITEKEY }), post: new Error('offline') }).fetchImpl,
      async solve() {
        return 'solved'
      },
    })
    expect(onExchange).toEqual({ ok: false, reason: 'unreachable' })
  })
})

describe('renewal timing', () => {
  test('a full-length grant is renewed a minute early', () => {
    const now = Date.now()
    expect(renewDelayMs(now + 15 * 60_000, now)).toBe(15 * 60_000 - RENEW_LEAD_MS)
  })

  test('a short or already-expired grant does not schedule a renewal storm', () => {
    const now = Date.now()
    expect(renewDelayMs(now + 5_000, now)).toBe(30_000)
    expect(renewDelayMs(now - 60_000, now)).toBe(30_000)
  })
})
