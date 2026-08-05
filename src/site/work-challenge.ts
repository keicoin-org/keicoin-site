/**
 * The clicker's half of the work grant (`worker/work-grant.ts`).
 *
 * Kept out of `clicker-client.ts` because that file only runs with a DOM and
 * this is the part worth testing: what happens when the endpoint is not
 * configured, when the challenge is refused, and when a grant is about to run
 * out mid-session. The one genuinely DOM-shaped step — putting a Turnstile
 * widget on the page and waiting for it — is injected as `solve`.
 *
 * The grant itself never passes through here. It is set as an `HttpOnly`
 * cookie scoped to the work path, so the browser attaches it to
 * `WorkServerProvider`'s same-origin `fetch` without the SDK knowing it exists
 * and without this file being able to read it back out.
 */

export interface GrantDeps {
  fetch: typeof globalThis.fetch
  /** Renders a challenge for `sitekey` and resolves with a solved token. */
  solve(sitekey: string): Promise<string>
}

export type GrantOutcome =
  | { ok: true; expiresAt: number }
  | { ok: false; reason: 'unconfigured' | 'unreachable' | 'refused' }

/** A minute of headroom, but never a renewal storm if the server hands back a short grant. */
export const RENEW_LEAD_MS = 60_000
const RENEW_FLOOR_MS = 30_000

export function renewDelayMs(expiresAt: number, now: number): number {
  return Math.max(RENEW_FLOOR_MS, expiresAt - now - RENEW_LEAD_MS)
}

/**
 * Asks for a grant. `ok: false` is not an error the page should shout about —
 * every branch of it means the same thing to a player, which is that
 * `Kei.start()` will generate work in this tab instead. Slower, and the
 * behaviour the site had before there was a Worker at all.
 */
export async function openWorkGrant(path: string, deps: GrantDeps): Promise<GrantOutcome> {
  let sitekey: string
  try {
    const discovery = await deps.fetch(path, { method: 'GET' })
    if (discovery.status === 503) return { ok: false, reason: 'unconfigured' }
    if (!discovery.ok) return { ok: false, reason: 'unreachable' }
    const body = (await discovery.json()) as { sitekey?: unknown }
    if (typeof body.sitekey !== 'string' || !body.sitekey) return { ok: false, reason: 'unconfigured' }
    sitekey = body.sitekey
  } catch {
    return { ok: false, reason: 'unreachable' }
  }

  let token: string
  try {
    token = await deps.solve(sitekey)
  } catch {
    return { ok: false, reason: 'refused' }
  }
  if (!token) return { ok: false, reason: 'refused' }

  try {
    const exchanged = await deps.fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      // The point of the whole exchange is the cookie that comes back.
      credentials: 'same-origin',
    })
    if (!exchanged.ok) return { ok: false, reason: exchanged.status === 503 ? 'unconfigured' : 'refused' }
    const body = (await exchanged.json()) as { expiresAt?: unknown }
    if (typeof body.expiresAt !== 'number') return { ok: false, reason: 'refused' }
    return { ok: true, expiresAt: body.expiresAt }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}
