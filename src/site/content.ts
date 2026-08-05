/**
 * Everything the site says, in one file.
 *
 * The rule this file exists to enforce: a claim is written once and rendered
 * many ways. The landing page, the use-case pages, `llms.txt` and `AGENTS.md`
 * all come from here, so the site cannot tell a human one thing and an agent
 * another — which matters more than usual, because the agent cannot notice
 * (SPEC §12).
 *
 * Second rule, and the harder one: **every page states its own limits.** An
 * agent adopting Kei on a false premise ships a broken integration into
 * somebody's game, and it has no way to discount enthusiasm. Overstating here is
 * a defect with a delay.
 */

import type { Page } from './layout.js'

/** The player half and the issuer half, which is the whole shape of the SDK. */
export const PLAYER_SNIPPET = `
import { Kei } from 'kei-transaction'

// Browser. Wallet created and persisted. No signup, API key, or dashboard.
const kei = await Kei.start()

const order = await createOrder({ sku: 'sword' })
const payment = await kei.pay({ to: gameAddress, amount: 0.05 })
await attachPayment(order.id, payment.hash) // durable server-side record
await kei.token('GEM', gameAddress).then(g => g.balance())
`

export const ISSUER_SNIPPET = `
import { Kei } from 'kei-transaction'

// Server only — it refuses to run in a browser, loudly, on purpose.
const game = await Kei.server({ seed: process.env.KEI_SEED })

const gems = await game.token.issue({
  name: 'Gems', symbol: 'GEM', decimals: 0,
  transfer: 'open',   // enforced by the chain, immutable
})

game.onPayment(async ({ from, amount }) => {
  if (amount >= 0.05) await gems.mint(from, 100)
})
`

export interface UseCase {
  /** The canonical VitePress page that answers this request. */
  path: string
  /** The nav label and the h1. */
  label: string
  /** How the request actually arrives, verbatim. This is the matched string. */
  asks: string[]
  /** One line, for the landing page and the meta description. */
  claim: string
}

export interface Track {
  name: string
  /** One line. The landing page and `llms.txt` show this. */
  where: string
  /** Several. `/status` shows this. */
  state: string
  /** The written condition that finishes it. Not a date, not a percentage. */
  done: string
}

/**
 * The four concurrent tracks (SPEC §13). They replaced the M0–M10 ladder on
 * 3 August 2026, and they are here rather than in three hand-written copies
 * because the landing page, `/status` and `llms.txt` all state them and the
 * one that drifts is the one nobody reads until an agent quotes it.
 *
 * `done` is a condition somebody could check, never a schedule. A track with a
 * date on it is a track that starts lying on that date.
 */
export const TRACKS: Track[] = [
  {
    name: 'Economy DX',
    where: 'The priority. The primitives ship and are measured; what is being closed is the distance between an economy you can describe in a sentence and the code that runs it.',
    state:
      'The primitives are shipped and measured. What is being closed is the distance between an economy you can describe in a sentence and the code that runs it. `@keicoin/economy` — declarative recipes with a dry run before anything is signed, plus weighted loot-table drops (`economy.drop()` / `economy.verifyDrop()`, bound into the same claim root as an ordinary reward) — is published at 0.2.2. `@keicoin/player-economy` — the player-owned shop that lists, buys, cancels and gifts through the player\'s own key — is published at 0.1.2. **The current `kei-transaction@0.8.0` umbrella depends on both and on `@keicoin/market@0.4.0`.** The earlier `0.6.0` release was the first umbrella to close the gap where every package was on npm but a plain install still resolved an older market and no shop at all. `kei.economy` and `kei.shop` are both reachable from a clean install now.',
    done: 'Somebody who has never seen Kei describes an economy — currency, sink, item with stats, sale, resale — and has it running without reading a spec, operating a database, or exceeding the sixty-second path.',
  },
  {
    name: 'Create Kei MMO',
    where: 'The creation harness. **An unpublished draft, and far from its own claim** — fresh blank 2D and 3D projects now install, build, and prove a first shared authoritative encounter, but the one bounded harness pass still stops at the first plan step.',
    state: '**An unpublished draft. At integration checkpoint `b6edae7`, criteria 2–6 are met only for fresh blank 2D and 3D construction scope; criteria 1, 7, 8, and 9 remain open.** See below.',
    done: 'One invocation produces a project that installs, builds, runs, shows two clients each other, persists, trades, and presents one 30-second core loop at release quality — and keeps working after the harness is deleted.',
  },
  {
    name: 'Chain and public network',
    where: 'One node at `https://testnet.keicoin.org/rpc`, reporting `store_version 24`, with conformance run against it rather than a fresh CI database.',
    state:
      'One node at `https://testnet.keicoin.org/rpc`, reporting `store_version 24` since it was rebuilt on 3 August 2026. Conformance runs against it rather than against a fresh CI database.',
    done: 'The published conformance suites pass against the live public node, over the public URL, from a ledger that existed before the binary did.',
  },
  {
    name: 'Surfaces — wallet, examples, this site',
    where: 'Both wallets merged, Button and World of Wonder running. **Carpet Markets is the weak one**, and it is a mock-chain demo.',
    state: 'Both wallets are merged. Button and World of Wonder are running. **Carpet Markets is the weak one** — see below.',
    done: 'Every claim on this site is checkable in one step from the page making it, the standalone wallet shows a player’s items from a game that is not running, and Carpet Markets meets its nine written criteria.',
  },
]

export interface HarnessCriterion {
  /** What one invocation, with no edits, has to produce. */
  requirement: string
  /** Where it stands today. A table cell, so one clause. */
  today: string
}

/**
 * The one-shot criteria Create Kei MMO is measured against (SPEC §11.3).
 *
 * There are **nine**. The site published eight, missing the presentation gate
 * added on 4 August 2026 — an understatement of the harness's own bar in the
 * direction that flatters it, because an agent reading the shorter list
 * concludes a networked gray box would pass. Criterion 8 moved with it:
 * deleting the harness has to leave the presentation proof standing too, not
 * only the systems checks.
 *
 * Written here rather than per surface for the usual reason — the landing page,
 * `/status` and the examples index all quote the count, and the copy that
 * drifts is the one an agent ends up quoting.
 */
export const HARNESS_CRITERIA: HarnessCriterion[] = [
  {
    requirement: 'An exit status of 0 and one machine-readable result, having prompted for nothing',
    today: 'Partly — for a run that stops after the first plan step',
  },
  { requirement: 'A project that installs and builds with no human edit', today: 'Met for fresh blank 2D and 3D projects' },
  {
    requirement: 'A server that starts and a client that connects, headless',
    today: 'Met for fresh blank 2D and 3D projects — a headless client connects to the authoritative game server',
  },
  {
    requirement: '**Two clients seeing each other move**',
    today: 'Met for fresh blank 2D and 3D projects — each headless client observes the other’s server-authored movement',
  },
  {
    requirement:
      'A persistent, server-authoritative world — position and progression survive a restart, and a forged client message is rejected',
    today: 'Met for fresh blank 2D and 3D projects — server-assigned identity, position, XP, and derived level survive clean restarts; forged authority changes neither memory nor SQLite',
  },
  {
    requirement:
      'An economy on Kei: a currency issued, an item minted, a player-to-player trade settled, the game server holding no balance',
    today: 'Met for fresh blank 2D and 3D projects — published `kei-transaction@0.6.0`, direct player custody, and one atomic trade',
  },
  {
    requirement: 'Every capability domain either implemented or listed as deferred, naming its status',
    today: 'Open end to end — planned and absent statuses are recorded, but the one-turn result does not implement or defer every selected available domain',
  },
  {
    requirement: 'All of 2–7, and the presentation proof in 9, still passing after the harness is deleted',
    today: 'Advanced, not met — the generated runtime has no harness dependency or import, but the remaining criteria do not pass yet',
  },
  {
    requirement:
      '**One 30-second core loop that is presentable, not merely functional** — a coherent admitted art set, blended motion, SFX, effects, camera and UI feedback fired off the animation, and a declared post-processing tier inside its frame budget. No T-pose, gray box, missing asset, silent impact or synth placeholder',
    today: 'Open',
  },
]

/**
 * Spelled out, because the prose around it says "nine criteria" and a bare
 * digit in that sentence reads as one of the criterion numbers beside it.
 */
export const HARNESS_CRITERIA_COUNT: string =
  ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][HARNESS_CRITERIA.length] ??
  String(HARNESS_CRITERIA.length)

export const USE_CASES: UseCase[] = [
  {
    path: '/docs/reference/tokens',
    label: 'Add an in-game currency',
    claim: 'One call issues it. No database, no payment processor, no balances table.',
    asks: [
      'add an in-game currency to my game',
      'add coins / gems / credits players can earn and spend',
      'give my game a soft currency without a backend',
    ],
  },

  {
    path: '/docs/reference/items',
    label: 'Build an inventory system',
    claim: 'Items are supply-1 tokens. Ownership is a balance lookup. There is no indexer.',
    asks: [
      'build an inventory system for my game',
      'let players own items that persist',
      'add equipment / collectibles / NFT-style items without the NFT stack',
    ],
  },

  {
    path: '/docs/examples/carpet-markets/api',
    label: 'Add an auction house or community market',
    claim: 'Listings, settlement and price history become consensus instead of code you maintain.',
    asks: [
      'add an auction house to my game',
      'build a Steam-style community market',
      'let players trade items with each other safely',
      'add a player-to-player trading system',
    ],
  },

  {
    path: '/docs/examples/world-of-wonder/auction-house',
    label: 'Add an MMO economy',
    claim: 'A hosted Babylon.js + Colyseus prototype keeps gold and items in the Kei SDK ledger instead of the game database.',
    asks: [
      'add an economy to my MMO',
      'build a multiplayer game with a shared economy',
      'add currency and trading to my multiplayer game',
    ],
  },

  {
    path: '/docs/examples/world-of-wonder/loot-and-drops',
    label: 'Hand out loot to thousands of players',
    claim: 'One issuer block covers the whole batch; every player claims in parallel.',
    asks: [
      'hand out rewards to a lot of players at once',
      'implement loot drops that are actually on-chain',
      'airdrop items or currency to thousands of players',
    ],
  },

  {
    path: '/docs/reference/wallet#payments',
    label: 'Take sub-cent payments',
    claim: 'A card processor cannot take $0.001, because the fee exceeds the payment. A feeless chain can.',
    asks: [
      'take micropayments in my game or app',
      'charge a fraction of a cent per action',
      'accept payments without Stripe or a payment processor',
    ],
  },
]

export const PAGES: Page[] = [
  {
    path: '/status',
    title: 'Status — Kei',
    heading: 'What actually works',
    summary:
      'Published early and updated as it changes, including the parts that say "not yet". A page that only becomes honest at launch was never honest.',
    blocks: [
      { kind: 'prose', text: 'The installable SDK is **`kei-transaction@0.8.0`**, `@keicoin/market` is **0.4.0** and a plain install reaches it, and since 3 August 2026 the public testnet settles rooted claims and atomic swaps end to end. Everything below is either something you can install, something you can run, or something this page says is not built.' },
      { kind: 'prose', text: 'Milestone numbers are gone. The M0–M10 ladder was retired on 3 August 2026 because the work stopped being a sequence — four tracks now run at once, each finished by its own condition rather than by its turn.' },

      { kind: 'heading', text: 'The four tracks' },
      {
        kind: 'table',
        head: ['Track', 'Where it is', 'Finished when'],
        rows: TRACKS.map((track) => [`**${track.name}**`, track.state, track.done]),
      },
      { kind: 'prose', text: '**Mainnet is not a fifth track, and it is not a build task.** It is gated by validator distribution, reserve governance, and a legal conversation — none of which any repository can ship its way through. Nothing here is mainnet-ready, and no amount of work in a demo makes it so.' },

      { kind: 'heading', text: 'What you can install and run today' },
      {
        kind: 'table',
        head: ['', 'State'],
        rows: [
          ['The SDK', '`bun add kei-transaction` gets you **0.8.0**. The `@keicoin/*` packages it resolves: `tokens` at 0.5.3, `claims` at 0.5.1, `wallet` at 0.5.1, `economy` at 0.2.2, `market` at 0.4.0, `player-economy` at 0.1.2, `core` at 0.5.0, and `work` at 0.4.2. Wallet, send, receive, issue, mint, transfer, `balanceOf`, `burn`, items and stats, commit, claim, the market, `kei.shop`, loot-table drops, and the in-game wallet panel ship with TypeScript types. Payment memos are not in the current wire contract; correlate purchases by payment hash.'],
          ['Published vs installed', 'Not the same thing, and this row exists because the gap is where a wrong claim got made. For about three hours on 4 August 2026, every Kei package was on npm and a plain `bun add kei-transaction` still did not reach two of them: the `0.5.0` umbrella pinned `@keicoin/market@^0.1.1` — a range `0.2.0` falls outside — and took no `@keicoin/player-economy` dependency at all, so `kei.shop` was `undefined` and `market.book()`, `series()`, `candles()` and `accept({ expect })` were unreachable without adding the package yourself. **`kei-transaction@0.6.0`, published the same day, is the umbrella that took both dependencies.** That gap is closed: every namespace resolves. A different gap is open, and it is the ordinary one. `0.8.0` pins caret ranges, and under semver a `0.x` caret does not cross the minor — so `@keicoin/core@^0.5.0`, `claims@^0.5.1` and `market@^0.4.0` cannot reach `core@0.6.0`, `claims@0.6.0` or `market@0.5.0`, which are all on npm. Installing the umbrella is not the same as installing the newest of each part; to get one of those you add it yourself and accept that you are ahead of the coordinated release.'],
          ['The market', 'Published as `@keicoin/market@0.4.0` and reached by a plain `bun add kei-transaction` at 0.8.0. Books rank cheapest asks and highest bids by exact cross-multiplied raw ratios, including asset decimal scaling; the public `unitPrice` and `spread` fields remain numbers for display and can tie after conversion. **Settling on the public testnet.** An offer locks the units at the ledger, a second sale of the same units is refused, and one accept moves both legs — measured against the node, then again over the public URL once the gateway was taught to forward `swap_info` and `account_swaps`.'],
          ['The mock chain', 'Available explicitly through `Kei.mock()` for deterministic tests, and used by the hosted demos. It enforces the real ledger rules — one chain per account, derived asset ids, receivable arrivals, work tiers, the issuance burn, supply caps, transfer policy, and the double-claim index.'],
          ['The node', 'The public node was rebuilt onto `master` on 3 August 2026 and reports `store_version 24`. Before that, a claims-or-swaps binary could not open a ledger written by an earlier one at all — the new tables were added to an existing store version instead of getting their own, and only a fresh database, which is all CI ever starts from, was unaffected.'],
          ['The network', 'One rate-limited, best-effort public dev-network node at `https://testnet.keicoin.org/rpc`. It has weak consensus, no uptime promise, published dev keys, and no monetary value. There is no mainnet.'],
          ['Wallets', 'Both merged. The in-game panel ships in `kei-transaction@0.8.0` (`@keicoin/wallet@0.5.1`); the standalone wallet, forked from BananoVault, is on [kei-wallet](https://github.com/keicoin-org/kei-wallet)’s default branch, and its market panel is wired to `kei.market` — it shows that wallet’s own offers, cancellable, and its settled trades. The network’s book stays unshowable: an offer lives on its author’s chain and Kei ships no indexer, so the panel says that rather than presenting a handful of offers as the market.'],
          ['Button — the demo', 'Playable at [/examples/button](/examples/button). Press a button, bank presses, claim them, buy upgrades that live on the ledger instead of in a save file. Its multiplayer draft is unmerged and has no authenticated wallet ownership, so the deployed single-player game is the honest one.'],
          ['World of Wonder', 'Published as [world-of-wonder](https://github.com/keicoin-org/world-of-wonder) and hosted at [mmo.keicoin.org](https://mmo.keicoin.org). Gold and items are chain assets; the database keeps accounts, characters and positions. The repository settles on the public testnet by default and `KEI_NETWORK=mock` runs it against a chain inside its own process — but **the hosted copy runs that mock**, so nothing on it survives a restart. Its auction house is implemented end to end. [Merged phase one](https://github.com/keicoin-org/world-of-wonder/pull/8) makes legacy inventory, equipment, and gold rows inert instead of presenting them as ownership; because the wallet-proof verifier does not exist yet, gameplay currently refuses equipping, consuming, dropping, pickups, and gold or item rewards.'],
        ],
      },

      { kind: 'heading', text: 'Carpet Markets is a mock-chain demo, and a weak one' },
      { kind: 'prose', text: 'It is playable at [/examples/carpet-markets](/examples/carpet-markets) and it is the worked demo of `@keicoin/market`: every trade is an offer one player wrote and another accepted, settled in one block, and whether a market can exist at all is the coin’s immutable `transfer` policy. That argument holds, and its tests assert it at the ledger rather than in the client.' },
      { kind: 'prose', text: 'The interface around that argument remains materially weaker than the launchpads it is modelled on, but it is less weak after the merged and deployed product-UX work. Six of its nine criteria now have committed checks. The remaining three are browser behaviours that were reported passing once, but that walk was never committed and there is no Playwright dependency in the repository, so a clean clone cannot reproduce the evidence.' },
      {
        kind: 'list',
        ordered: true,
        items: [
          'A first-time visitor with no wallet completes one buy in five interactions or fewer. **Open: reported passing, but the browser walk is not committed.**',
          'Every state that can refuse a trade — an unsynced receivable, units locked in an open offer, spendable below the ask — is named on screen *before* the action, not surfaced as a failure after it. **Met** — `lib/refusals.ts` and its tests name each state before the action.',
          'A trade’s result appears without a manual refresh, and pending stays visually distinct from confirmed throughout. **Met** — `lib/balance.ts` carries the three numbers all the way to the screen.',
          'Price, volume and holder panels say "no trades yet" rather than showing a zero. **Met.**',
          'No horizontal scroll at a 360 px viewport, with the primary action reachable. **Open: reported passing, but the browser walk is not committed.**',
          'Launch → sell → buy → cancel completable by keyboard alone. **Open: reported passing, but the browser walk is not committed.**',
          'The transfer-policy badge is the loudest element on a card and links to the ledger fact behind it. **Met.**',
          'Every claim the interface makes is asserted at the ledger by a test. **Met** for the claims that exist.',
          'Each known hole — the account-bounded book, one open quote per address, off-chain replies — is stated on the screen where it bites, not only in the README. **Met.**',
        ],
      },
      {
        kind: 'limits',
        title: 'And it cannot become mainnet-ready',
        items: [
          'It runs a **no-value mock chain** inside one Durable Object. Its versioned event log is authoritative: a fresh instance replays accepted ledger, launch, watch and reply mutations, so eviction or a routine deploy does not reset the demo. Deleting that object’s storage is the explicit reset.',
          'That event log is append-only and grows with successful demo mutations. It is deliberately small-demo infrastructure, not an indexer or production ledger; compaction and storage bounds remain follow-up work.',
          'A launchpad is the **worst possible first thing** to put on a real network — it is the one demo whose entire subject is people losing money. It is defensible as satire precisely because the coins are worth nothing.',
          '**Mainnet is not a build task.** Nothing shipped in this demo moves validator distribution, reserve governance, or the legal conversation, and those are what gate it.',
          'So do not read any roadmap into this. It should refuse a real network outright, and the page should say so — which is what this one is doing.',
        ],
      },

      { kind: 'heading', text: 'Create Kei MMO does not build a complete MMO yet' },
      { kind: 'prose', text: `The harness’s headline promise is that you describe an MMO and get one. **That promise is currently far from met**, and "early" was not a thing anybody could check, so it now has ${HARNESS_CRITERIA_COUNT} criteria that are.` },
      { kind: 'prose', text: 'Where it actually is at draft integration head `b6edae7`: the repository’s default branch still carries the **retired three-template scaffolder**. The unpublished work behind [PR #1](https://github.com/keicoin-org/create-kei-game/pull/1) resolves an intent, plans it, prepares the project, and then runs **one bounded engine pass over the first step of that plan** — a real provider call, three workspace-scoped tools, at most 24 model round-trips and thirty minutes — and stops. Fresh blank 2D and Babylon.js 3D generated projects now install, build, and start a loopback-only authoritative 20 Hz game server. The [First Shared Encounter](https://github.com/keicoin-org/create-kei-game/pull/12) uses the generated project’s shared browser/headless connection, assigns player IDs on the server, and proves two headless clients observe each other move. [PR #16](https://github.com/keicoin-org/create-kei-game/pull/16) makes those server-assigned characters restart-safe, and [PR #15](https://github.com/keicoin-org/create-kei-game/pull/15) adds a separate generated economy proof using the published `kei-transaction@0.6.0` package. There is no Kei terminal UI, no session past that one pass, and no package published under either name.' },
      {
        kind: 'table',
        head: ['#', 'One invocation, no edits, must produce…', 'Today'],
        rows: HARNESS_CRITERIA.map((criterion, index) => [String(index + 1), criterion.requirement, criterion.today]),
      },
      { kind: 'prose', text: '**Criteria 2, 3, 4, 5, and 6 are met at this unpublished draft integration checkpoint, only for fresh blank 2D and 3D construction scope.** The committed smoke installs and builds fresh blank projects, starts the generated game server, connects clients through the same module the browser uses, and proves two clients see each other’s server-authored movement. The generated `bun run restart-proof` crosses clean process restarts with the exact server-assigned player ID, position, XP, and server-derived level intact. A forged identity, position, progression, inventory, balance, currency, or settlement field changes neither live memory nor SQLite. The browser receives a 32-byte opaque resume token while SQLite stores only its SHA-256 hash and the character fields; the database schema stores no Kei economy state. It also runs the generated `bun run economy:check` proof: a separate issuer provisions GOLD and a Founder’s Sword directly to two player wallets, a mismatched expectation changes nothing, and the correct player-signed acceptance settles both legs atomically while the game server holds no Kei asset or credential. This is construction-scale proof on private local state and a deterministic mock chain, not a runtime trade UI or public deployment.' },
      { kind: 'prose', text: '**Criteria 1, 7, 8, and 9 remain open.** One invocation still stops after its first plan step; capability coverage remains open end to end; the incomplete criteria cannot yet keep passing after the harness is deleted; and there is no release-quality 30-second presentation proof. A resume capability is not account recovery, and a socket character is not cryptographically bound to a Kei wallet. SQLite WAL is not a multi-writer store or a guarantee against crash loss. Scale, public hosting, prediction/reconciliation, and cross-shard migration remain outside this checkpoint.' },
      { kind: 'prose', text: 'Criterion 4 is the one that decides whether the MMO boundary exists, and this checkpoint crosses that boundary for fresh blank projects. Criterion 5 now proves the narrow clean-restart character boundary, and criterion 6 proves a separate custody boundary: player wallets, not the game server, sign and hold the trade assets. Together they preserve the ownership split — SQLite owns character position and progression but no economy; Kei owns currency, items, and trade — without establishing account recovery, socket-to-wallet identity, crash-safe distributed persistence, scale, public hosting, or a finished game.' },
      { kind: 'prose', text: 'Criterion 9 decides whether it is worth showing anyone. [Issue #17](https://github.com/keicoin-org/create-kei-game/issues/17) is the detailed target: one recordable 30-second encounter with admitted art, blended motion, real audio and synchronized feedback inside a declared frame budget. A gray box with working netcode and atomic trade is still not a game anybody would play, so a T-pose, a silent hit or a placeholder beep is an honest state to build through and not a state to finish in. It is also why criterion 8 covers 2–7 *and* the presentation proof: deleting the harness has to leave the look and sound of the thing standing, not only its systems tests.' },
      { kind: 'prose', text: 'If you want a running Kei MMO today, fork [World of Wonder](/docs/examples/world-of-wonder). That is a real one, and it is what the harness may eventually plan with.' },

      { kind: 'heading', text: 'Run the evidence yourself' },
      { kind: 'prose', text: 'Every claim above that is about behaviour has a command behind it. These are the commands, not a summary of them.' },
      {
        kind: 'code',
        caption: 'The sixty-second path, and the live conformance run against the public node',
        code: `bun add kei-transaction@0.8.0

git clone https://github.com/keicoin-org/kei-transaction
cd kei-transaction && bun install
bun run check            # typecheck + the hermetic suite
bun run test:m3-live     # against https://testnet.keicoin.org/rpc — needs the internet, no key`,
      },
      {
        kind: 'code',
        caption: 'The market claims, asserted at the ledger rather than in the client',
        code: `git clone https://github.com/keicoin-org/carpet-markets
cd carpet-markets && bun install
bun run check     # typecheck, worker typecheck, and the tests

# test/registry.test.ts is where the transfer-policy badge is either true or
# marketing: a soulbound coin cannot be offered, an issuer-only coin cannot move
# between two holders, an open one settles peer to peer, and the launch fee does
# not drift as coins pile up.`,
      },
      {
        kind: 'code',
        caption: 'The shared-encounter, restart-persistence, and player-custodied economy checkpoint, then what the harness would decide',
        code: `git clone -b codex/m9-game-harness https://github.com/keicoin-org/create-kei-game
cd create-kei-game

# Pin the unpublished integration checkpoint described above and run its
# exact protocol plus generated-project smoke.
git checkout b6edae7
bun install
bun run test:generated     # clean 2D/3D; each runs restart-proof + economy:check

# --plan-only needs no provider, no credential, and touches no directory.
bun run src/index.ts -- "Salvage Run" --3d \\
  --gameplay "Crews salvage derelict stations and haul cargo home." \\
  --plan-only`,
      },
      { kind: 'prose', text: '`--plan-only` prints the engine decision and its reasons, every reference candidate and its score, the capability packets selected and deferred, the constraints, the acceptance criteria, and the build order. It is the honest thing to run first, because it shows you what is deferred before anything is written.' },

      { kind: 'heading', text: 'What was measured, and when' },
      { kind: 'prose', text: 'This section used to say a public claims-and-swaps deployment was "not evidenced here", which was a polite way of saying nobody had checked. It was checked on 3 August 2026, from a clean `npm install kei-transaction` against `https://testnet.keicoin.org/rpc`.' },
      {
        kind: 'list',
        items: [
          '**Payments, automatic receive, issuance and its burn, mint and `balanceOf` all work** against the public node. Re-issuing the same symbol returns the same asset id; the issuer’s balance really does drop by 1 on its first asset.',
          '**`token.commit()` — rooted claims — works.** The conformance suite passes against the node: one issuer block, three player claims, correct balances, and a second claim from the same account refused.',
          '**`market.sell()` / `accept()` — atomic swaps — work**, and the whole flow passes over the public URL: offer, lock, refused double-sale, settlement.',
          '**The first rows of that list were `Block is invalid` the same morning**, on a node predating both block types. Evidence about a deployment is behavioural: `store_version` and a passing suite, not `build_info`, which is stamped at configure time and lied for several hours.',
          '**[The exact SDK suite](https://github.com/keicoin-org/kei-transaction/pull/9) is shared from a pinned revision**, so the node gate and the live check run the same contract. The pinned run: 11 pass on the base surface, 2 on claims, 3 on the market.',
        ],
      },

      { kind: 'heading', text: 'What this means for you' },
      {
        kind: 'limits',
        title: 'Do not',
        items: [
          'Put real value anywhere near this. There is no token, no mainnet, and until the validator set is meaningfully distributed there should not be.',
          'Read "a public testnet exists" as "a production network exists". It does not.',
          'Ship a production economy on it. Build against it, and expect the chain under the API to change.',
          'Read "claims and swaps settle on the testnet" as "the network is durable". One node accepting the blocks is a working API, not consensus. The ledger survived its last rebuild; that is a fact about one afternoon, not a promise.',
          'Treat **Carpet Markets** as a market you could operate, or **Create Kei MMO** as a tool that produces a working game. Both are named above with what is actually true of them.',
        ],
      },
      { kind: 'prose', text: 'What you **can** do today is build against the published 0.8.0 API and a public testnet that carries claims and swaps, keep tests deterministic with `Kei.mock()`, and fork a worked example that already runs.' },

      { kind: 'heading', text: 'Known and stated plainly' },
      {
        kind: 'list',
        items: [
          '**Network security.** The public testnet is one best-effort dev node with weak consensus, not a production network.',
          '**No inherited liquidity.** Kei launches with no users, no exchanges, and no market.',
          '**No global order book.** An offer lives on its author’s chain and there is no indexer, so discovery is explicit — a registry, or account-scoped reads. Every front end shows the accounts it has heard of, and says so.',
          '**No pool, curve, or AMM.** `@keicoin/market` is bilateral. A pump-style venue would need a node-enforced pool primitive, which means reopening a settled decision; it is backlog, not planned work.',
          '**The 0.8.0 SDK release is installable, and every namespace is present — but it is not the newest of every part.** Re-run on 5 August 2026 in an empty directory — `npm init -y && npm install kei-transaction` — rather than read off a checkout or off registry metadata. The resolved tree is `kei-transaction@0.8.0` over `@keicoin/core@0.5.0`, `work@0.4.2`, `claims@0.5.1`, `tokens@0.5.3`, `market@0.4.0`, `wallet@0.5.1`, `economy@0.2.2` and `player-economy@0.1.2`, and importing the umbrella from that install gives a client whose `shop`, `economy`, `market`, `items` and `claims` namespaces are all present. `core@0.6.0`, `claims@0.6.0` and `market@0.5.0` are also on npm and a plain install does not reach them, because a `0.x` caret does not cross the minor; the next umbrella is what moves those, not a reinstall. Create Kei MMO is not released; npm still serves the superseded `create-kei-game@0.2.0` scaffolder, which is a different product, and nothing is published as `create-kei-mmo`.',
          '**No smart contract VM**, deliberately. If your design needs one, Kei is the wrong tool and this page would rather you found out here.',
        ],
      },
    ],
  },
]
