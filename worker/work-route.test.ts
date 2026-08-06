/**
 * The ordering guarantee in keicoin-org/keicoin-site#45: "a request that fails
 * the gate must be rejected *before* `generateWork` is entered, since entering
 * it is the cost."
 *
 * Since #47 that is two gates — the per-IP limit and tier cap in
 * `src/site/work-gate.ts`, and the grant in `worker/work-grant.ts` — and one
 * more place for the search to be, which is a Durable Object rather than the
 * isolate serving the pages. `generateWork` is now only reachable through
 * `env.WORK_MINT`, so these tests assert on the namespace itself. A test that
 * never sees `WORK_MINT.idFromName` called is a test that proves no search was
 * started, and that no page request was queued behind one.
 */

import { afterEach, describe, expect, test } from 'bun:test'

import worker, { WorkMint } from './index.js'
import { CLICK_GRANT_PATH, CLICK_WORK_PATH } from '../src/site/clicker-network.js'
import { GRANT_BURST, GRANT_COOKIE, GRANT_TTL_MS, grantCookie, mintGrant } from './work-grant.js'

const SECRET = '0x4AAAAAAA-not-a-real-turnstile-secret'
const SITEKEY = '0x4AAAAAAA-not-a-real-turnstile-sitekey'
const ROOT = 'A'.repeat(64)
const IP = '203.0.113.7'

function testEnv(overrides: Record<string, unknown> = {}) {
  const opened: string[] = []
  const limited: string[] = []
  const env = {
    ASSETS: { async fetch() { return new Response('asset response', { status: 207 }) } },
    WORK_RATE_LIMIT: {
      async limit({ key }: { key: string }) {
        limited.push(key)
        return { success: true }
      },
    },
    WORK_MINT: {
      idFromName(name: string) {
        opened.push(name)
        return name
      },
      get(id: string) {
        return {
          async fetch() {
            return new Response(JSON.stringify({ work: 'DEADBEEFDEADBEEF', id }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
          },
        }
      },
    },
    TURNSTILE_SITEKEY: SITEKEY,
    TURNSTILE_SECRET: SECRET,
    ...overrides,
  }
  return { env, opened, limited }
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}): Request =>
  new Request(`https://keicoin.org${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': IP, ...headers },
    body: JSON.stringify(body),
  })

const workBody = { action: 'work_generate', hash: ROOT, tier: 'B' }
const cookieHeader = (token: string): Record<string, string> => ({ cookie: `${GRANT_COOKIE}=${token}` })

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('nothing reaches the search without a grant', () => {
  test('an anonymous work request is refused, opens no object, and spends no rate-limit quota', async () => {
    const { env, opened, limited } = testEnv()
    const response = await worker.fetch(post(CLICK_WORK_PATH, workBody), env as never)

    expect(response.status).toBe(401)
    expect((await response.json() as { error: string }).error).toContain(CLICK_GRANT_PATH)
    expect(opened).toEqual([])
    // The grant check is pure CPU, so a flood with no grant never reaches the
    // limiter binding either.
    expect(limited).toEqual([])
  })

  test.each([
    ['an unsigned cookie', `${'a'.repeat(32)}.${String(Date.now() + 60_000)}.forged`],
    ['a cookie that is not a grant at all', 'not-a-grant'],
    ['an empty cookie', ''],
  ])('%s opens no object', async (_label, token) => {
    const { env, opened } = testEnv()
    const response = await worker.fetch(post(CLICK_WORK_PATH, workBody, cookieHeader(token)), env as never)

    expect(response.status).toBe(401)
    expect(opened).toEqual([])
  })

  test('a grant signed with a different secret opens no object', async () => {
    const { env, opened } = testEnv()
    const foreign = await mintGrant('somebody else\'s secret', Date.now())

    const response = await worker.fetch(
      post(CLICK_WORK_PATH, workBody, cookieHeader(foreign.token)),
      env as never,
    )

    expect(response.status).toBe(401)
    expect(opened).toEqual([])
  })

  test('an expired grant opens no object even though it is genuinely signed', async () => {
    const { env, opened } = testEnv()
    const stale = await mintGrant(SECRET, Date.now() - GRANT_TTL_MS - 1_000)

    const response = await worker.fetch(post(CLICK_WORK_PATH, workBody, cookieHeader(stale.token)), env as never)

    expect(response.status).toBe(401)
    expect(opened).toEqual([])
  })

  test('a valid grant asking for tier A opens no object', async () => {
    const { env, opened } = testEnv()
    const grant = await mintGrant(SECRET, Date.now())

    const response = await worker.fetch(
      post(CLICK_WORK_PATH, { ...workBody, tier: 'A' }, cookieHeader(grant.token)),
      env as never,
    )

    expect(response.status).toBe(403)
    expect((await response.json() as { error: string }).error).toContain('answers tiers B and C')
    expect(opened).toEqual([])
  })

  test('a valid grant over the per-IP limit opens no object', async () => {
    const { env, opened } = testEnv({
      WORK_RATE_LIMIT: { async limit() { return { success: false } } },
    })
    const grant = await mintGrant(SECRET, Date.now())

    const response = await worker.fetch(post(CLICK_WORK_PATH, workBody, cookieHeader(grant.token)), env as never)

    expect(response.status).toBe(429)
    expect(opened).toEqual([])
  })

  test('a valid grant does reach its own object, named after the grant', async () => {
    const { env, opened, limited } = testEnv()
    const grant = await mintGrant(SECRET, Date.now())

    const response = await worker.fetch(post(CLICK_WORK_PATH, workBody, cookieHeader(grant.token)), env as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ work: 'DEADBEEFDEADBEEF' })
    expect(opened).toEqual([grant.id])
    expect(limited).toEqual([IP])
  })
})

describe('an unconfigured deploy serves nobody', () => {
  test.each([CLICK_WORK_PATH, CLICK_GRANT_PATH])('%s answers 503 and opens no object', async (path) => {
    const { env, opened } = testEnv({ TURNSTILE_SECRET: undefined, TURNSTILE_SITEKEY: undefined })
    const response = await worker.fetch(post(path, workBody), env as never)

    expect(response.status).toBe(503)
    expect((await response.json() as { error: string }).error).toContain('Turnstile')
    expect(opened).toEqual([])
  })

  test('minting refuses when the rate-limit binding went missing, as #47 requires', async () => {
    const { env, opened } = testEnv({ WORK_RATE_LIMIT: undefined })
    const response = await worker.fetch(post(CLICK_GRANT_PATH, { token: 'solved' }), env as never)

    expect(response.status).toBe(503)
    expect(opened).toEqual([])
  })

  test('minting refuses where the edge set no client IP', async () => {
    const { env, opened } = testEnv()
    const request = new Request(`https://keicoin.org${CLICK_GRANT_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'solved' }),
    })

    expect((await worker.fetch(request, env as never)).status).toBe(403)
    expect(opened).toEqual([])
  })
})

describe('the grant endpoint', () => {
  test('GET hands the clicker the public site key and nothing else', async () => {
    const { env } = testEnv()
    const response = await worker.fetch(new Request(`https://keicoin.org${CLICK_GRANT_PATH}`), env as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sitekey: SITEKEY })
  })

  test('a solved token becomes a scoped cookie, and the object is registered first', async () => {
    const { env, opened } = testEnv()
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ success: true }))) as unknown as typeof globalThis.fetch

    const response = await worker.fetch(post(CLICK_GRANT_PATH, { token: 'solved' }), env as never)

    expect(response.status).toBe(200)
    expect(opened).toHaveLength(1)

    const cookie = response.headers.get('set-cookie') ?? ''
    expect(cookie).toContain(`${GRANT_COOKIE}=${opened[0]}.`)
    expect(cookie).toContain(`Path=${CLICK_WORK_PATH}`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
  })

  test('a token Turnstile rejects yields no cookie and no object', async () => {
    const { env, opened } = testEnv()
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
      )) as unknown as typeof globalThis.fetch

    const response = await worker.fetch(post(CLICK_GRANT_PATH, { token: 'replayed' }), env as never)

    expect(response.status).toBe(403)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(opened).toEqual([])
  })
})

describe('the object holds the budget the site cannot', () => {
  function fakeState() {
    const store = new Map<string, unknown>()
    let alarm: number | undefined
    return {
      alarmAt: () => alarm,
      store,
      state: {
        storage: {
          async get<T>(key: string) { return store.get(key) as T | undefined },
          async put<T>(key: string, value: T) { store.set(key, value) },
          async deleteAll() { store.clear() },
          async setAlarm(at: number) { alarm = at },
        },
      },
    }
  }

  const workPost = () =>
    new Request('https://work-mint.invalid/work', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(workBody),
    })

  test('an object that was never minted refuses work', async () => {
    const { state } = fakeState()
    const mint = new WorkMint(state as never, {} as never)

    expect((await mint.fetch(workPost())).status).toBe(401)
  })

  test('minting sets the sweep alarm at the grant expiry, and the alarm empties it', async () => {
    const fake = fakeState()
    const mint = new WorkMint(fake.state as never, {} as never)
    const expiresAt = Date.now() + GRANT_TTL_MS

    await mint.fetch(new Request(`https://work-mint.invalid/mint?expires=${expiresAt}`, { method: 'POST' }))
    expect(fake.alarmAt()).toBe(expiresAt)
    expect(fake.store.get('expiresAt')).toBe(expiresAt)
    expect(fake.store.get('bucket')).toMatchObject({ tokens: GRANT_BURST })

    await mint.alarm()
    expect(fake.store.size).toBe(0)
    // Swept is revoked: the cookie's signature is still good and this still fails.
    expect((await mint.fetch(workPost())).status).toBe(401)
  })

  test('a drained bucket refuses before any search is started', async () => {
    const fake = fakeState()
    const mint = new WorkMint(fake.state as never, {} as never)
    await mint.fetch(
      new Request(`https://work-mint.invalid/mint?expires=${Date.now() + GRANT_TTL_MS}`, { method: 'POST' }),
    )
    fake.store.set('bucket', { tokens: 0, updatedAt: Date.now() })

    const refused = await mint.fetch(workPost())
    expect(refused.status).toBe(429)
    expect(Number(refused.headers.get('retry-after'))).toBeGreaterThan(0)
  })

  test('a grant past its expiry is refused by the object as well as by the signature', async () => {
    const fake = fakeState()
    const mint = new WorkMint(fake.state as never, {} as never)
    fake.store.set('expiresAt', Date.now() - 1)
    fake.store.set('bucket', { tokens: GRANT_BURST, updatedAt: Date.now() })

    expect((await mint.fetch(workPost())).status).toBe(401)
  })
})

describe('the rest of the site is untouched', () => {
  test('an ordinary page still goes straight to the asset binding', async () => {
    const { env, opened, limited } = testEnv()
    const response = await worker.fetch(new Request('https://keicoin.org/docs/reference/tokens'), env as never)

    expect(response.status).toBe(207)
    expect(opened).toEqual([])
    expect(limited).toEqual([])
  })

  test('the grant cookie is scoped so it is never sent to a page', () => {
    expect(grantCookie('t', 900, CLICK_WORK_PATH)).toContain(`Path=${CLICK_WORK_PATH}`)
  })
})
