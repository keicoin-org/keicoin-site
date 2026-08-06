/**
 * keicoin.org, on Cloudflare.
 *
 * Mostly this is a static site: everything that is not one of the two paths
 * below goes straight to the asset binding. The exception is the work server
 * the homepage clicker points `Kei.start({ workServer })` at.
 *
 * Why that route has to exist: without a work server, `Kei.start()` falls back
 * to `LocalWorkProvider` (`@keicoin/work`), which runs blake2b proof-of-work
 * synchronously in the visitor's own tab — a visible freeze per press for a
 * `send` block (tier B, ~8.4M expected hashes). The SDK's own docs call a work
 * server "required v1 infrastructure" for exactly this reason (`@keicoin/core`'s
 * work.ts, SPEC §5.5).
 *
 * ## Two gates, because they stop different things (#45, #47)
 *
 * `gateWorkRequest` (`src/site/work-gate.ts`, from #47) is the outer one: a
 * per-IP rate limit, a size cap, and the tier cap that refuses tier A. It stays
 * exactly as it landed, and it is still the right first thing to do to a
 * request — it is cheap and it bounds a naive loop.
 *
 * What it cannot do is decide who the caller *is*, because an IP is not a
 * credential. keicoin-org/kei-transaction#153 makes that argument about the
 * SDK's own limiter and it applies here unchanged: "a per-key ceiling is worth
 * nothing when keys are free". An IP is one proxy away. So the inner gate is a
 * Turnstile solve exchanged for a signed grant (`worker/work-grant.ts`), which
 * is the only credential this site can ask for that it did not hand out for
 * free.
 *
 * ## Why the search is in a Durable Object
 *
 * #47 named this and deliberately left it: "The work route still shares an
 * isolate with `env.ASSETS`. Bounding who may enter the loop bounds that; it
 * does not remove it." This removes it.
 *
 * `generateWork` is a synchronous loop with no `await` in it, so nothing yields
 * while it runs — and the handler it ran in is also the one that serves `/`,
 * `/docs` and every other page out of `env.ASSETS`. SPEC §10.4 puts the site on
 * Cloudflare specifically so it does not share a failure domain with the node:
 * "a testnet node falling over is a Tuesday, and the page explaining what Kei is
 * going down with it is a much worse day." That reasoning does not stop at the
 * node. A work endpoint that can stall the page explaining what Kei is, is the
 * same mistake one layer in.
 *
 * So the search moved into `WorkMint`, one Durable Object per grant:
 *
 *   1. `stub.fetch()` is an awaited RPC, so this isolate is free the moment it
 *      forwards. A search can no longer stall an asset request.
 *   2. A Durable Object is single-threaded, so one visitor's searches queue
 *      against each other — and, because the object is named after their grant,
 *      against nobody else's.
 *   3. The token bucket lives in Durable Object storage instead of a module
 *      global, so it survives isolate recycling rather than resetting to full
 *      whenever Cloudflare feels like it.
 *
 * The alternative #47 suggested — a dedicated long-running `kei-work-server`
 * with `workServer` pointed at it — also separates the isolates, but it is a
 * second box to run and it puts the site's clicker back into a failure domain
 * §10.4 spent effort getting it out of. A Durable Object is the same separation
 * inside the same deploy.
 *
 * ## Operational note for whoever deploys this
 *
 * `/kei/work` needs `TURNSTILE_SITEKEY` (a var) and `TURNSTILE_SECRET` (a
 * secret) from one Turnstile widget bound to keicoin.org, in addition to the
 * `WORK_RATE_LIMIT` binding #47 added. Until the Turnstile pair is set the
 * endpoint answers 503 and serves nobody, which is deliberate for the same
 * reason #47's missing-binding branch is: `createWorkProvider` already falls
 * back to `LocalWorkProvider` when the work server is unreachable, so an
 * unconfigured deploy degrades to the pre-Worker behaviour — a slower press —
 * rather than a broken clicker. Failing closed is therefore free.
 */

import { HttpNode } from 'kei-transaction'
import { LocalWorkProvider, workRpcHandler } from '@keicoin/work'

import {
  CLICK_GRANT_PATH,
  CLICK_NETWORK,
  CLICK_NODE_URL,
  CLICK_WORK_PATH,
} from '../src/site/clicker-network.js'
import { gateWorkRequest, type WorkGateEnv } from '../src/site/work-gate.js'
import {
  GRANT_BURST,
  GRANT_COOKIE,
  GRANT_TTL_MS,
  MAX_GRANT_REQUEST_BYTES,
  grantCookie,
  mintGrant,
  readCookie,
  readGrant,
  spendWorkToken,
  verifyTurnstile,
  type Bucket,
} from './work-grant.js'

interface Env extends WorkGateEnv {
  ASSETS: { fetch(request: Request): Promise<Response> }
  WORK_MINT: DurableObjectNamespace
  /** Overrides the node the work server reads proof-of-work thresholds from. */
  KEI_NODE_URL?: string
  /** Public Turnstile site key. Served to the clicker by `GET CLICK_GRANT_PATH`. */
  TURNSTILE_SITEKEY?: string
  /** Turnstile secret, and the key the grant cookie is signed with. */
  TURNSTILE_SECRET?: string
}

/**
 * Declared structurally rather than imported from `@cloudflare/workers-types`,
 * and `WorkMint` is a plain class rather than a `cloudflare:workers`
 * `DurableObject` subclass, so that `bun test` can import this module —
 * `src/site/canonical-doc-routes.test.ts` drives `fetch` directly, and a
 * `cloudflare:workers` import is unresolvable outside `workerd`. The classic
 * Durable Object form is fully supported and costs nothing here.
 */
interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
  deleteAll(): Promise<void>
  setAlarm(scheduledTime: number): Promise<void>
}
interface DurableObjectState {
  storage: DurableObjectStorage
}
interface DurableObjectStub {
  fetch(request: Request): Promise<Response>
}
interface DurableObjectNamespace {
  idFromName(name: string): unknown
  get(id: unknown): DurableObjectStub
}

interface WorkerHandler {
  fetch(request: Request, env: Env): Promise<Response>
}

const JSON_HEADERS = { 'content-type': 'application/json' }

const json = (status: number, body: object, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } })

/** Said on both paths, so it is written once. */
const UNCONFIGURED =
  'This work server is not accepting requests: no Turnstile widget is configured. ' +
  'Work will be generated in the browser instead.'

/**
 * One per grant. Holds that grant's expiry and its token bucket, and is the only
 * place `generateWork` runs.
 */
export class WorkMint {
  /**
   * `LocalWorkProvider` reads the node's tier thresholds once
   * (`this.thresholds ??=`) and keeps them for its own lifetime, so pinning the
   * provider pins the thresholds too. #47 fixed that for the module global with
   * a 5-minute TTL; the same hazard follows the provider in here, and a Durable
   * Object can live a great deal longer than a request isolate, so it keeps a
   * TTL of its own.
   */
  private static readonly PROVIDER_TTL_MS = 5 * 60_000

  private readonly state: DurableObjectState
  private readonly env: Env
  private handler: ((request: Request) => Promise<Response>) | undefined
  private handlerNodeUrl: string | undefined
  private handlerBuiltAt = 0

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const now = Date.now()

    if (url.pathname === '/mint') {
      const expiresAt = Number(url.searchParams.get('expires') ?? '0')
      await this.state.storage.put('expiresAt', expiresAt)
      // Full, not empty: what cost something was the Turnstile solve that got
      // here, and making the first press of a fresh grant wait out a refill
      // would tax the honest caller for the attacker's behaviour.
      await this.state.storage.put<Bucket>('bucket', { tokens: GRANT_BURST, updatedAt: now })
      // The sweep keicoin-org/kei-transaction#153 asks for, at the moment the
      // grant stops being spendable rather than whenever the bucket happens to
      // look idle.
      await this.state.storage.setAlarm(expiresAt)
      return json(200, { ok: true })
    }

    const expiresAt = await this.state.storage.get<number>('expiresAt')
    // The signature said this grant was minted; storage says whether it still
    // is. A grant swept by the alarm fails here even though its HMAC is intact,
    // which is what makes the sweep a revocation rather than bookkeeping.
    if (!expiresAt || now >= expiresAt) return json(401, { error: 'work grant has expired' })

    const spend = spendWorkToken(await this.state.storage.get<Bucket>('bucket'), now)
    await this.state.storage.put('bucket', spend.bucket)
    if (!spend.allowed) {
      return json(
        429,
        { error: 'too many work requests for this grant' },
        { 'retry-after': String(Math.max(1, Math.ceil(spend.retryAfterMs / 1000))) },
      )
    }

    return this.workHandler()(request)
  }

  /** Fired at the grant's expiry. */
  async alarm(): Promise<void> {
    await this.state.storage.deleteAll()
  }

  private workHandler(): (request: Request) => Promise<Response> {
    const nodeUrl = this.env.KEI_NODE_URL ?? CLICK_NODE_URL
    const now = Date.now()
    if (!this.handler || this.handlerNodeUrl !== nodeUrl || now - this.handlerBuiltAt > WorkMint.PROVIDER_TTL_MS) {
      const node = new HttpNode({ url: nodeUrl, network: CLICK_NETWORK })
      this.handler = workRpcHandler({ provider: new LocalWorkProvider(node) })
      this.handlerNodeUrl = nodeUrl
      this.handlerBuiltAt = now
    }
    return this.handler
  }
}

/**
 * `GET` hands the clicker the public site key; `POST` exchanges a solved
 * Turnstile token for the grant cookie.
 */
async function handleGrant(request: Request, env: Env): Promise<Response> {
  const { TURNSTILE_SITEKEY: sitekey, TURNSTILE_SECRET: secret } = env
  if (!sitekey || !secret) return json(503, { error: UNCONFIGURED })

  if (request.method === 'GET') return json(200, { sitekey })
  if (request.method !== 'POST') return json(405, { error: 'POST required' })

  // Minting makes an outbound siteverify call, so it is rate-limited on the
  // same binding and the same terms as the work path itself. Same two default
  // refusals as #47's gate: no binding and no client IP both mean no.
  const limiter = env.WORK_RATE_LIMIT
  if (!limiter) return json(503, { error: 'the work server is not accepting requests' })
  const ip = request.headers.get('cf-connecting-ip')
  if (!ip) return json(403, { error: 'the work server is not accepting requests' })
  if (!(await limiter.limit({ key: ip })).success) {
    return json(429, { error: 'too many work grant requests; generate work locally instead' })
  }

  const raw = await request.arrayBuffer()
  if (raw.byteLength > MAX_GRANT_REQUEST_BYTES) return json(413, { error: 'request body is too large' })

  let token: unknown
  try {
    token = (JSON.parse(new TextDecoder().decode(raw)) as { token?: unknown }).token
  } catch {
    return json(400, { error: 'invalid JSON' })
  }
  if (typeof token !== 'string') return json(400, { error: 'token must be a string' })

  const outcome = await verifyTurnstile({ secret, token, ip })
  if (!outcome.ok) return json(403, { error: `Turnstile rejected this token: ${outcome.reason}` })

  const grant = await mintGrant(secret, Date.now())
  // Registered before the cookie goes out: a cookie whose object has no expiry
  // recorded is refused, so the order matters.
  const stub = env.WORK_MINT.get(env.WORK_MINT.idFromName(grant.id))
  const registered = await stub.fetch(
    new Request(`https://work-mint.invalid/mint?expires=${grant.expiresAt}`, { method: 'POST' }),
  )
  if (!registered.ok) return json(503, { error: 'could not open a work grant' })

  return json(
    200,
    { expiresAt: grant.expiresAt },
    { 'set-cookie': grantCookie(grant.token, Math.floor(GRANT_TTL_MS / 1000), CLICK_WORK_PATH) },
  )
}

async function handleWork(request: Request, env: Env): Promise<Response> {
  const secret = env.TURNSTILE_SECRET
  if (!secret) return json(503, { error: UNCONFIGURED })

  // Order is the whole point. The grant check is pure CPU and no I/O, so a
  // flood with no grant costs one HMAC each and never reaches the limiter, the
  // object, or a search. Then #47's gate — IP limit, size, tier. Then, and only
  // then, an object, in an isolate that is not this one.
  const grant = await readGrant(secret, readCookie(request.headers.get('cookie'), GRANT_COOKIE), Date.now())
  if (!grant) {
    return json(401, { error: `no valid work grant. POST a Turnstile token to ${CLICK_GRANT_PATH} first.` })
  }

  const gate = await gateWorkRequest(request, env)
  if (!gate.ok) return gate.response

  const stub = env.WORK_MINT.get(env.WORK_MINT.idFromName(grant.id))
  return stub.fetch(
    new Request('https://work-mint.invalid/work', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: await gate.request.text(),
    }),
  )
}

/**
 * Editorial pages that moved keep permanent redirects to their canonical docs
 * destinations. `/examples/<demo>` is untouched — those are the demos
 * themselves, on their own Workers' path routes, and this Worker never sees
 * them. Exact matches prevent a redirect from swallowing a running demo.
 */
// The trailing slash is VitePress's own canonical form for a directory index,
// so this lands on a 200 rather than on the asset binding's second redirect.
export const MOVED = new Map([
  ['/examples', '/docs/examples/'],
  ['/examples/', '/docs/examples/'],
  ['/use-cases', '/#use-cases'],
  ['/use-cases/', '/#use-cases'],
  ['/use-cases/in-game-currency', '/docs/reference/tokens'],
  ['/use-cases/in-game-currency/', '/docs/reference/tokens'],
  ['/use-cases/inventory-system', '/docs/reference/items'],
  ['/use-cases/inventory-system/', '/docs/reference/items'],
  ['/use-cases/community-market', '/docs/examples/carpet-markets/api'],
  ['/use-cases/community-market/', '/docs/examples/carpet-markets/api'],
  ['/use-cases/mmo-economy', '/docs/examples/world-of-wonder/auction-house'],
  ['/use-cases/mmo-economy/', '/docs/examples/world-of-wonder/auction-house'],
  ['/use-cases/loot-drops', '/docs/examples/world-of-wonder/loot-and-drops'],
  ['/use-cases/loot-drops/', '/docs/examples/world-of-wonder/loot-and-drops'],
  ['/use-cases/micropayments', '/docs/reference/wallet#payments'],
  ['/use-cases/micropayments/', '/docs/reference/wallet#payments'],
])

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    // Before CLICK_WORK_PATH, because it is a child of it.
    if (url.pathname === CLICK_GRANT_PATH) return handleGrant(request, env)
    if (url.pathname === CLICK_WORK_PATH) return handleWork(request, env)
    const moved = MOVED.get(url.pathname)
    if (moved) return Response.redirect(new URL(moved, url).toString(), 301)
    return env.ASSETS.fetch(request)
  },
} satisfies WorkerHandler
