/**
 * keicoin.org, on Cloudflare.
 *
 * Until now this was pure static assets — no Worker script, `wrangler.jsonc`
 * had no `main`. This adds exactly one route: `CLICK_WORK_PATH`
 * (`src/site/clicker-network.ts`), the work server the homepage clicker
 * points `Kei.start({ workServer })` at.
 *
 * Why that route has to exist: without a work server, `Kei.start()` falls
 * back to `LocalWorkProvider` (`@keicoin/work`), which runs blake2b
 * proof-of-work synchronously in the visitor's own tab — a multi-second
 * freeze per press for a `send` block (tier B, ~8.4M expected hashes). The
 * SDK's own docs call a work server "required v1 infrastructure" for exactly
 * this reason (`@keicoin/core`'s work.ts, SPEC §5.5). `workRpcHandler` is the
 * same `Request → Response` handler `@keicoin/work/server`'s
 * `startWorkServer` wraps in a `node:http` listener for a long-running
 * process (see `button/worker/index.ts` for the Durable-Object-backed sibling
 * of this file, and `packages/work/src/cli.ts` for the standalone process);
 * here the Worker fetch handler is the transport, so nothing else is needed.
 *
 * Everything that is not that one path goes straight to the asset binding —
 * the site's behaviour is otherwise unchanged.
 *
 * Operational note for whoever deploys this: the proof-of-work search is a
 * real synchronous CPU cost (tier B is ~8.4M expected hashes), so this Worker
 * raises its CPU limit (`limits.cpu_ms` in wrangler.jsonc) and needs a Workers
 * plan with enough CPU time to match. If that turns out not to be enough
 * headroom in practice, the fix is a dedicated long-running work server
 * (`kei-work-server`, `@keicoin/work/server`) with `workServer` pointed at it
 * instead — a one-line change here, not a rewrite.
 */

import { HttpNode } from 'kei-transaction'
import { LocalWorkProvider, workRpcHandler } from '@keicoin/work'

import { CLICK_NETWORK, CLICK_NODE_URL, CLICK_WORK_PATH } from '../src/site/clicker-network.js'

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** Overrides the node the work server reads proof-of-work thresholds from. */
  KEI_NODE_URL?: string
}

interface WorkerHandler {
  fetch(request: Request, env: Env): Promise<Response>
}

let handler: ((request: Request) => Promise<Response>) | undefined
let handlerNodeUrl: string | undefined

/** Built once per isolate and reused across requests — thresholds rarely change. */
function workHandler(env: Env): (request: Request) => Promise<Response> {
  const nodeUrl = env.KEI_NODE_URL ?? CLICK_NODE_URL
  if (!handler || handlerNodeUrl !== nodeUrl) {
    const node = new HttpNode({ url: nodeUrl, network: CLICK_NETWORK })
    handler = workRpcHandler({ provider: new LocalWorkProvider(node) })
    handlerNodeUrl = nodeUrl
  }
  return handler
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
    if (url.pathname === CLICK_WORK_PATH) return workHandler(env)(request)
    const moved = MOVED.get(url.pathname)
    if (moved) return Response.redirect(new URL(moved, url).toString(), 301)
    return env.ASSETS.fetch(request)
  },
} satisfies WorkerHandler
