# keicoin-site

`keicoin.org`, on Cloudflare. It is the project's only public face, and it has
two audiences that want the same facts in different shapes: a developer deciding
whether Kei solves their problem, and — increasingly — the agent reading on that
developer's behalf.

```sh
bun install
bun run dev      # build, then wrangler dev
bun test         # the copy guards and the clicker logic
bun run check    # full build + wrangler deploy --dry-run
```

`keicoin.org` is the only domain this project uses. Anything else claiming to be
Kei is not.

## The rules this repository exists to hold

Four, and every one of them has been broken here at least once.

**A claim is written once and rendered many ways.** `src/site/content.ts` is the
source record for the landing page, use-case pages, `/status`, `llms.txt` and
`AGENTS.md`. VitePress is the source owner for `/docs`, with `docs/index.md` as
its human quickstart; there is deliberately no non-rendered `/docs` record in
`PAGES`. A build-level parity test keeps the machine-readable economy claims on
that deployed human page. Three hand-written copies of a fact is three chances
to publish one that stopped being true — and the copy that drifts is always the
one an agent quotes.

**Every page states its own limits, at the same volume as its capabilities.** An
agent cannot detect overstatement and cannot ask a follow-up question, so a claim
a human would discount as enthusiasm becomes a specification, and then a broken
integration in somebody's game. Overstating here is not optimism; it is a defect
with a delay.

**Every claim is checkable in one step from the page making it.** Prefer a
command somebody can run or a URL they can open over a sentence they have to
believe. `/status` carries the commands behind its behavioural claims rather than
a summary of them.

**The site is never the source of truth for the API.** It links to the package
and to `SPEC.md`. A documentation site that drifts from its SDK is how an agent
writes code against a function that no longer exists.

## What must not be claimed here

These are the current, live corrections — not general caution.

- **Nothing is mainnet-ready, and mainnet is not a build task.** It is gated by
  validator distribution, reserve governance and a legal conversation, none of
  which any repository ships its way through. No page may imply a launch, a
  date, or a sequence that ends in one.
- **Carpet Markets is a demo of the market API on a mock chain**, materially
  weaker than the launchpads it is modelled on, and it cannot become
  mainnet-ready — a launchpad is the worst possible first thing to put on a real
  network. Point readers at `lib/market.ts`, not at the interface around it.
- **Create Kei MMO does not produce a complete working MMO.** It is an
  unpublished draft that plans a project and runs one bounded engine pass at
  the first step of that plan. At draft integration head `9d1e60a`, fresh blank
  2D and 3D projects close criteria 2–4 and 6: they install, build, prove two
  headless clients see each other move, and run one player-custodied atomic Kei
  trade. Criterion 5 remains open while draft PR #16 is reconciled; criteria 1,
  7, 8, and 9 and socket-to-wallet proof also remain open. The
  `create-kei-game@0.2.0` package on npm is a retired scaffolder and a different
  product.
- **No milestone numbers.** The M0–M10 ladder was retired on 3 August 2026 and
  replaced by four concurrent tracks. A page still saying "M5" describes a plan
  that no longer exists.

`src/site/claims.test.ts` and `src/site/harness-docs.test.ts` hold all four down.
If one fails, the copy is wrong — not the test.

## Layout

| | |
|---|---|
| `src/site/content.ts` | **The generated-site source record.** The use cases, the four tracks, and `/status`. It never owns `/docs`. |
| `src/site/layout.ts` | The page shell and the block renderer. `SITE` holds the status line that appears on every page. |
| `src/site/home.ts` | The landing page, including the pressable hero button. |
| `src/site/machine.ts` | `llms.txt`, `AGENTS.md`, `robots.txt`, the sitemap — the same facts, no prose. |
| `src/site/clicker-*.ts` | The homepage clicker: the one hydrated island on the site. |
| `src/site/demos.ts` | Where each demo's built client is, per demo, so a local `wrangler dev` serves what production serves. |
| `docs/` | VitePress and the sole owner of `/docs`. `docs/index.md` is the deployed quickstart; the directory also holds guides, API reference, and example writing. |
| `worker/index.ts` | One route — the same-origin work endpoint the hero button needs — and the `/examples` redirect. Everything else is the asset binding. |
| `build.ts` | Writes `dist/`. No framework, no bundler, no hydration. |

## Routes, and the distinction that keeps being lost

- **`/docs/examples/<name>` is the writing about a demo.** It is a section of the
  documentation, not a peer of it.
- **`/examples/<name>` is the demo itself**, served by that demo's own Worker on
  a more specific route. Nothing in this repository serves it in production; the
  copy in `build.ts` exists so a local `wrangler dev` behaves like the deployed
  site.

Link a human to the first. Both are on the same origin, one click apart, so an
agent that finds the explanation has already found the thing it can verify.

## Why Cloudflare and not the node's box

The site must not share a failure domain with the chain. A testnet node falling
over is a Tuesday; the page explaining what Kei is going down with it is a much
worse day.

## Building the demos locally

`build.ts` copies each demo's built client from a sibling checkout if it finds
one, walking up from this directory so it works in an ordinary checkout and in a
git worktree without either path being written down. A missing build is a
warning naming the path and the command that produces it, never a silent skip —
a silent skip is a deploy that ships the site without the demo.

MIT.
