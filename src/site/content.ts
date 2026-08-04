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
  path: string
  /** The nav label and the h1. */
  label: string
  /** How the request actually arrives, verbatim. This is the matched string. */
  asks: string[]
  /** One line, for the landing page and the meta description. */
  claim: string
  page: Page
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

const NEXT_STEPS = {
  kind: 'next' as const,
  links: [
    { href: '/examples/button', label: 'Play the demo', note: 'The whole SDK, running, in a browser tab.' },
    { href: '/docs', label: 'Read the quickstart', note: 'Install to a confirmed payment, in about sixty seconds.' },
    { href: '/status', label: 'Check what actually works', note: 'Four tracks, what each owes, and the commands that prove it.' },
  ],
}

const MOCK_CAVEAT =
  '`Kei.start()` defaults to the public testnet, which since 3 August 2026 has been running a build that accepts rooted-claim and swap blocks. It is still one rate-limited, best-effort dev node with weak consensus, published dev keys, and no uptime promise — not a distributed network. The API is real and now measured against that node, but **nothing on it holds value.**'

export const USE_CASES: UseCase[] = [
  {
    path: '/use-cases/in-game-currency',
    label: 'Add an in-game currency',
    claim: 'One call issues it. No database, no payment processor, no balances table.',
    asks: [
      'add an in-game currency to my game',
      'add coins / gems / credits players can earn and spend',
      'give my game a soft currency without a backend',
    ],
    page: {
      path: '/use-cases/in-game-currency',
      title: 'Add an in-game currency — Kei',
      heading: 'Add an in-game currency',
      summary:
        'A game currency in one function call, with balances on a chain instead of in a database you operate. `balanceOf` answers in a single call, and you never write a migration.',
      asks: [],
      blocks: [
        { kind: 'prose', text: 'The usual version of this task is a `balances` table, a service in front of it, an audit trail, and a permanent worry about double-spends and rollbacks. The currency is the easy part; **operating a ledger correctly is the work.**' },
        { kind: 'prose', text: 'On Kei the ledger is consensus. You issue the token and the chain holds the balances.' },
        {
          kind: 'code',
          caption: 'Issuer — server side',
          code: `const gems = await game.token.issue({
  name: 'Gems',
  symbol: 'GEM',
  decimals: 0,
  maxSupply: 1_000_000,     // optional; caps circulating supply

  transfer: 'open',         // 'open' | 'issuer-only' | 'none' — protocol-enforced
  swap: 'one-way',          // a promise to players, recorded on-chain
  rate: 100,                // your desk's price. Never on-chain, so you can change it.
})

await gems.mint(playerAddress, 500)
await gems.balanceOf(playerAddress)   // 500 — one call`,
        },
        { kind: 'heading', text: 'The one decision that matters' },
        { kind: 'prose', text: '`transfer` is immutable and enforced by the protocol, not by your code. It is the only real mechanism for a closed economy, and it cannot be changed after issuance.' },
        {
          kind: 'table',
          head: ['Value', 'What it means', 'Choose it when'],
          rows: [
            ['open', 'Players can trade with each other. A permissionless market can and eventually will appear.', 'You want a real economy, and you accept you will not control the secondary market.'],
            ['issuer-only', 'Players genuinely cannot trade with each other. Not "we discourage it" — they cannot.', 'You need a closed economy and mean it.'],
            ['none', 'Soulbound. Units can only be burned.', 'Achievements, reputation, anything that should not have a price.'],
          ],
        },
        { kind: 'heading', text: 'What it costs' },
        { kind: 'prose', text: '**Your first token burns 1 Kei.** The nth asset an account issues burns n Kei — the tenth costs 10, the five hundredth costs 500 — and it is the one operation on Kei that is not free, because an asset record is permanent state on every node forever. Every transaction after it — minting, sending, transferring, claiming — is free, always.' },
        { kind: 'prose', text: 'It escalates per account because that is the only limit consensus can apply without knowing who anybody is. A keypair is free and can be generated offline by the million, so there is nobody to rate-limit — but only an account can extend its own chain, so its issuance count is the one thing it cannot shed. A game issuing a currency and five hundred item types burns 125,751 Kei in total; one account issuing a million junk assets would burn five times the entire circulating supply, which is the point.' },
        { kind: 'prose', text: 'Give the currency a sink. A currency that is only ever minted inflates, and that is a design problem no chain fixes for you.' },
        {
          kind: 'limits',
          items: [
            MOCK_CAVEAT,
            'The issuer seed **must** stay on a server. `Kei.server()` refuses to run in a browser, because an issuer seed in a client is unlimited minting by anyone who views source.',
            'There is no exchange, no AMM, and no order book in the protocol. `rate` is your own configuration, not a market.',
          ],
        },
        NEXT_STEPS,
      ],
    },
  },

  {
    path: '/use-cases/inventory-system',
    label: 'Build an inventory system',
    claim: 'Items are supply-1 tokens. Ownership is a balance lookup. There is no indexer.',
    asks: [
      'build an inventory system for my game',
      'let players own items that persist',
      'add equipment / collectibles / NFT-style items without the NFT stack',
    ],
    page: {
      path: '/use-cases/inventory-system',
      title: 'Build an inventory system — Kei',
      heading: 'Build an inventory system',
      summary:
        'An item is a token with supply 1 and 0 decimals — not a special type, not a second code path, and no indexer to run. Ownership is `balanceOf`.',
      asks: [],
      blocks: [
        { kind: 'prose', text: 'Most item systems become two systems: the items, and the index that makes "what does this player own?" answerable. The index is the part that breaks, lags, and needs re-syncing.' },
        { kind: 'prose', text: 'Kei has no indexer because it does not need one. The same facts are stored in both directions — by account and by asset — so both questions are one lookup.' },
        {
          kind: 'code',
          caption: 'Create, mint, transfer, ask who owns it',
          code: `const sword = await game.items.create({
  name: 'Sword of Testing',
  description: 'It tests things.',
  image: './sword.png',
  supply: 100,             // omit for a unique item
  transfer: 'open',        // 'none' is soulbound
})

await game.items.mint(sword.id, playerAddress)

// Player side, signed by the player — there is no 'from' argument
await kei.items.transfer(sword.id, toAddress)
await kei.items.owner(sword.id)     // 'kei_3abc...'
await kei.items.ownedBy(address)    // [ item, ... ]`,
        },
        { kind: 'heading', text: 'Why this is worth doing' },
        { kind: 'prose', text: 'The inventory outlives your server. A player can open a wallet that has never heard of your game and see what they own — which is what makes "players own their items" true rather than a slogan. If the inventory lives only in your database, it is your inventory.' },
        { kind: 'prose', text: 'It also means your progression system has no save file. The demo restores every upgrade a player bought by reading the chain on load.' },
        {
          kind: 'limits',
          items: [
            MOCK_CAVEAT,
            'Items are **not** the place for per-instance mutable state. Durability, enchantments, and stack counts that change every minute belong in your game, not on a chain. Model the item; keep the fiddly state local.',
            'An account has a cap on how many distinct assets it can hold, so an item type per player per session is the wrong shape.',
            'Every item type is an asset, and the nth asset an account issues burns n Kei. A currency plus five hundred item types is 125,751 Kei in total — affordable for a catalogue somebody designed, and deliberately not for one a script generated.',
            'No royalties, no marketplace fees, and no VM to implement them in.',
          ],
        },
        NEXT_STEPS,
      ],
    },
  },

  {
    path: '/use-cases/community-market',
    label: 'Add an auction house or community market',
    claim: 'Listings, settlement and price history become consensus instead of code you maintain.',
    asks: [
      'add an auction house to my game',
      'build a Steam-style community market',
      'let players trade items with each other safely',
      'add a player-to-player trading system',
    ],
    page: {
      path: '/use-cases/community-market',
      title: 'Auction house and community market — Kei',
      heading: 'Add an auction house',
      summary:
        'The part of a game economy most likely to be exploited, and the part a small team cannot build safely. On Kei most of it stops being code you maintain.',
      asks: [],
      blocks: [
        { kind: 'prose', text: 'Every game with an economy eventually needs one: listings, bids, settlement, price history, anti-fraud, and a database with a server in front of it. It is weeks of work, it is where the exploits are, and **this is the actual product** — micropayments are just the demo.' },
        {
          kind: 'table',
          head: ['Component', 'Traditional', 'On Kei'],
          rows: [
            ['Listings', 'A table you own, plus a service', 'A signed block on the seller\'s own chain'],
            ['Escrow', 'You hold the item. You are now a custodian.', 'The offer locks the asset; nobody holds it for anyone'],
            ['Settlement', 'A transaction you must get exactly right', 'One atomic swap — both sides move or neither does'],
            ['Price history', 'An events table and a reporting job', 'Read it off the chain; it is already there'],
            ['Anti-fraud', 'Your problem, forever', 'A trade that does not balance is not a valid block'],
          ],
        },
        { kind: 'prose', text: 'The property doing the work is atomicity. A settlement that half-completes is the failure that costs you a weekend and a player\'s trust, and on a chain it is not a state that exists.' },
        {
          kind: 'limits',
          title: 'Read this before choosing Kei for a market',
          items: [
            '**The market is published as `@keicoin/market@0.4.0`, reached by the current `kei-transaction@0.8.0` umbrella, and the public testnet settles swaps.** Its books rank asks and bids by exact cross-multiplied ledger ratios even when two displayed `unitPrice` numbers tie; `unitPrice` and `spread` remain number-valued display fields, so a displayed spread can still be zero for different exact prices. Measured on 3 August 2026 over `https://testnet.keicoin.org/rpc`: an offer locks the units at the ledger, a second sale of the same units is refused, one accept moves both legs, and the gateway now forwards the two read actions (`swap_info`, `account_swaps`) a market needs. See [status](/status).',
            '**Nobody can show you the whole book.** An offer lives on its author\'s chain and Kei ships no indexer, so a front end has to keep the list of accounts to read. That is bookkeeping about where to look, not about who owns what — `carpet-markets`\' registry is the worked example.',
            '**[Carpet Markets](/docs/examples/carpet-markets) shows the API, not a finished market.** Its deployed no-value mock replays a storage-backed Durable Object event log across eviction, its front end is weaker than the pump-style launchpads it is modelled on, and it is not production-ready or mainnet-ready — it deliberately cannot be. Read `lib/market.ts` for the calls; do not copy the interface around them.',
            MOCK_CAVEAT,
            'A market only exists for tokens issued `transfer: "open"`. That is a decision you make once, at issuance, and cannot reverse.',
            'There is no order book or matching engine in the protocol, and there will not be. Offers are individual blocks; a front end aggregates them.',
            'There is no pool, curve, or AMM, and adding one would reopen a settled decision rather than extend this API. The [design note](/docs/examples/carpet-markets/future-pool-design) states what it would actually cost.',
          ],
        },
        NEXT_STEPS,
      ],
    },
  },

  {
    path: '/use-cases/mmo-economy',
    label: 'Add an MMO economy',
    claim: 'A hosted Babylon.js + Colyseus prototype keeps gold and items in the Kei SDK ledger instead of the game database.',
    asks: [
      'add an economy to my MMO',
      'build a multiplayer game with a shared economy',
      'add currency and trading to my multiplayer game',
    ],
    page: {
      path: '/use-cases/mmo-economy',
      title: 'MMO economy — Kei',
      heading: 'Add an MMO economy',
      summary:
        'Currency, items, and trading for a multiplayer game, with one rule that shapes everything: the game server is never the source of truth for money.',
      asks: [],
      blocks: [
        { kind: 'prose', text: 'A multiplayer game already needs an authoritative server for position, presence and combat. The temptation is to let it also be authoritative for the economy, because it is right there.' },
        { kind: 'prose', text: '**Do not.** A server that holds balances is a server whose crash, rollback, or compromise is an economic event. Keep it authoritative over the things that are genuinely its business, and let the chain hold the money.' },
        {
          kind: 'table',
          head: ['Concern', 'Where it belongs'],
          rows: [
            ['Position, presence, combat, rooms', 'Your game server (Colyseus, or whatever you use)'],
            ['What a quest pays, what a sword costs', 'Your game server — this is design, not custody'],
            ['Balances, ownership, transfers, trades', 'The chain. Always.'],
          ],
        },
        { kind: 'heading', text: 'Rewarding a lot of players at once' },
        { kind: 'prose', text: 'The scaling question in an MMO economy is not throughput, it is contention: if every reward is a write by your issuer account, that account is a global write lock. Kei\'s answer is that the issuer publishes one root committing to the whole batch, and each player writes their own claim from their own chain, in parallel. See [loot drops](/use-cases/loot-drops).' },
        {
          kind: 'limits',
          items: [
            MOCK_CAVEAT,
            '**The [hosted World of Wonder](https://mmo.keicoin.org) is live, not production-ready.** That copy runs a process-local mock chain, so nothing on it survives a restart. The source is public at [world-of-wonder](https://github.com/keicoin-org/world-of-wonder) and settles on the testnet by default.',
            '**Its auction house has the screen and the settlement underneath it.** Browse, Sell and Mine read listings from player chains; buying moves the item and gold in one settlement with the game server taking no part. The hall only knows accounts it has heard from. On the repository default branch, gameplay no longer treats the upstream inventory tables as ownership: those rows are inert, and equipping, consuming, dropping, pickups, and gold or item rewards refuse until a character can prove control of a wallet. That verifier is not built yet.',
            `**Create Kei MMO does not build the complete MMO for you yet, and is not close.** The harness is an unpublished draft: it plans the project and then runs one bounded engine pass over the first step of that plan. At draft integration checkpoint \`b6edae7\`, fresh blank 2D and 3D projects install, build, start an authoritative server, prove two headless clients see each other move, preserve server-assigned character state across clean restarts, and run one player-custodied atomic trade with published \`kei-transaction@0.6.0\`. Account recovery, socket-to-wallet proof, multi-writer and crash-loss guarantees beyond SQLite WAL, scale, public hosting, harness-deletion proof, and presentation remain open. Fork World of Wonder if you want a running MMO today — see [status](/status) for the ${HARNESS_CRITERIA_COUNT} criteria the harness is measured against.`,
            'A chain is not a low-latency datastore. Do not put anything on the critical path of a 60 Hz loop on it.',
            'Consensus is weak until the validator set is distributed. Until then this is a testnet with branding, and it is not somewhere to put real value.',
          ],
        },
        NEXT_STEPS,
      ],
    },
  },

  {
    path: '/use-cases/loot-drops',
    label: 'Hand out loot to thousands of players',
    claim: 'One issuer block covers the whole batch; every player claims in parallel.',
    asks: [
      'hand out rewards to a lot of players at once',
      'implement loot drops that are actually on-chain',
      'airdrop items or currency to thousands of players',
    ],
    page: {
      path: '/use-cases/loot-drops',
      title: 'Loot drops at scale — Kei',
      heading: 'Hand out loot to a thousand players',
      summary:
        'Minting per drop makes your issuer account a global write lock. Publish one root instead, and let each player write their own claim.',
      asks: [],
      blocks: [
        { kind: 'prose', text: 'The naive version works until it is used. One account has one chain, so a thousand rewards is a thousand sequential writes on your issuer, and the queue behind them is the game.' },
        { kind: 'prose', text: 'The fix moves the signature to the player. The issuer publishes **one block** containing a root that commits to the whole batch; each player is handed a proof and writes their own claim, from their own account, with no contention between them.' },
        {
          kind: 'code',
          caption: 'Issuer — one block, however large the batch',
          code: `const drop = await gems.commit([
  { to: playerA, amount: 500 },
  { to: playerB, amount: 120 },
  // ...thousands more
])

send(playerA, drop.proofFor(playerA))   // plain JSON, hand it over however you like`,
        },
        {
          kind: 'code',
          caption: 'Player — hand it to the SDK and it lands',
          code: `await kei.claims.add(bundle)

// Claiming happens in the background. A forged proof, a forged amount, or a
// second claim from the same account is rejected by the ledger, not the SDK.`,
        },
        { kind: 'prose', text: 'When a batch is old, close it: `await gems.close(drop.root)`. Closed roots take no further claims and become prunable. Nothing expires on a timer — this chain has no clock, deliberately.' },
        { kind: 'heading', text: 'Weighted tables, if you do not want to build the batch by hand' },
        { kind: 'prose', text: '`@keicoin/economy` (currently 0.2.2, reached by `kei-transaction@0.8.0`) turns a designer\'s loot table into the same commit under the hood — the table hashes into the root\'s salt, so a player folds one path proving the batch was published for this table and another proving it owes them this.' },
        {
          kind: 'code',
          caption: 'A weighted table, one roll per player, still one commit block',
          code: `const dragonHoard = defineDropTable({
  id: 'dragon-hoard',
  drops: [
    { asset: { symbol: 'GOLD' }, amount: 50, weight: 60 },
    { asset: { symbol: 'SWORD' },            weight: 10 },
  ],
  nothing: 30,
  issuer: GAME_ADDRESS,
})

const drop = await game.economy.drop(dragonHoard, party)
send(playerA, drop.awardFor(playerA))   // null if they rolled nothing

// Player — check it, then claim it the same way as any other drop
const { symbol, quantity, chance } = await kei.economy.verifyDrop(award)
await kei.claims.add(award)`,
        },
        {
          kind: 'limits',
          items: [
            MOCK_CAVEAT,
            'You must deliver the proof to the player yourself. The chain stores a root, not a list of who is owed what — that is the whole reason it is cheap.',
            'One entitlement per account per root. Two rewards for the same player in one batch merge into one leaf.',
            'A claim is a block, so a player who never comes back never claims. Budget for unclaimed drops rather than assuming delivery.',
            '`economy.drop()` is **not verifiable randomness.** The roll happens on your server, and nothing here proves the weights were honoured — only that a claimed award is really an entry in a table your issuer published. A 1% drop that never once rolls is invisible to every check on this page.',
          ],
        },
        NEXT_STEPS,
      ],
    },
  },

  {
    path: '/use-cases/micropayments',
    label: 'Take sub-cent payments',
    claim: 'A card processor cannot take $0.001, because the fee exceeds the payment. A feeless chain can.',
    asks: [
      'take micropayments in my game or app',
      'charge a fraction of a cent per action',
      'accept payments without Stripe or a payment processor',
    ],
    page: {
      path: '/use-cases/micropayments',
      title: 'Sub-cent payments — Kei',
      heading: 'Take sub-cent payments',
      summary:
        'The reason this project can exist: a card processor cannot take a $0.001 payment, because the fee exceeds the payment. A feeless chain can.',
      asks: [],
      blocks: [
        { kind: 'prose', text: 'Every payment processor has a floor set by its own fees, and the floor is somewhere around fifty cents. Below it, the economics invert and you end up bundling — "buy 500 gems for $4.99" — which is a workaround, not a design.' },
        { kind: 'prose', text: 'Transactions on Kei are free. Not cheap: free. So the floor is gone, and a payment can be worth a tenth of a cent.' },
        { kind: 'code', caption: 'Both halves of a purchase', code: `// Player — one signed transaction
const order = await createOrder({ sku: 'retry' })
const payment = await kei.pay({ to: gameAddress, amount: 0.001 })
await attachPayment(order.id, payment.hash) // persists order by send hash

// Game server — onPayment.hash is the receive hash, not payment.hash
game.onPayment(async ({ from, amount, hash: receiveHash }) => {
  const receive = await game.client.node.blockInfo(receiveHash)
  if (!receive || receive.type !== 'state' || !['open', 'receive'].includes(receive.subtype)) return
  await purchases.recordPayment({ sendHash: receive.link, receiveHash, from, amount })
  await reconcile(receive.link)
})` },
        { kind: 'prose', text: '`pay()` returns the player\'s **send** hash. `onPayment.hash` is the game\'s **receive** hash; resolve that block and use its `link` to recover the send hash. Persist payments and orders independently by send hash, then run the same atomic, idempotent `reconcile(sendHash)` after either write — the payment can arrive before the browser attaches it to an order. A Kei payment has no memo field in the current wire contract, and the SDK rejects `pay({ memo })` instead of silently dropping it.' },
        { kind: 'prose', text: 'A purchase is **always** two signed transactions. There is no `charge(someoneElse, …)` and there never will be — a game cannot sign for a player\'s wallet. Any API implying otherwise is a bug.' },
        {
          kind: 'limits',
          items: [
            MOCK_CAVEAT,
            'Free means no transaction fee. Anti-spam is proof-of-work instead — the SDK ships work-server integration for it in `@keicoin/work`.',
            '**Issuing an asset burns Kei — 1 for an account\'s first, n for its nth.** Transactions are free; creating permanent state on every node forever is not.',
            'This is not a way to take money from customers today. There is no mainnet, no exchange, and no liquidity — see [status](/status).',
          ],
        },
        NEXT_STEPS,
      ],
    },
  },
]

export const PAGES: Page[] = [
  ...USE_CASES.map((useCase) => ({ ...useCase.page, asks: useCase.asks })),

  {
    path: '/use-cases',
    title: 'What Kei is for — Kei',
    heading: 'What people actually ask for',
    summary:
      'Kei is a feeless chain with native tokens and an SDK. That is rarely how the problem arrives, so these are the jobs it is for, named the way the request is usually phrased.',
    blocks: [
      { kind: 'prose', text: 'Each page states what Kei does for that job, the code that does it, and — in the same size type — what is not true yet.' },
      {
        kind: 'next',
        links: USE_CASES.map((useCase) => ({ href: useCase.path, label: useCase.label, note: useCase.claim })),
      },
    ],
  },

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
          ['The SDK', '`bun add kei-transaction` gets you **0.8.0**. The `@keicoin/*` packages under it: `tokens` at 0.5.2, `claims` at 0.5.1, `wallet` at 0.5.0, `economy` at 0.2.2, `market` at 0.4.0, `player-economy` at 0.1.2, `core` at 0.5.0, and `work` at 0.4.1. Wallet, send, receive, issue, mint, transfer, `balanceOf`, `burn`, items and stats, commit, claim, the market, `kei.shop`, loot-table drops, and the in-game wallet panel ship with TypeScript types. Payment memos are not in the current wire contract; correlate purchases by payment hash.'],
          ['Published vs installed', 'Not the same thing, and this row exists because the gap is where a wrong claim got made. For about three hours on 4 August 2026, every Kei package was on npm and a plain `bun add kei-transaction` still did not reach two of them: the `0.5.0` umbrella pinned `@keicoin/market@^0.1.1` — a range `0.2.0` falls outside — and took no `@keicoin/player-economy` dependency at all, so `kei.shop` was `undefined` and `market.book()`, `series()`, `candles()` and `accept({ expect })` were unreachable without adding the package yourself. **`kei-transaction@0.6.0`, published the same day, is the umbrella that took both dependencies.** The gap is closed, and a clean install now resolves the same versions the registry shows.'],
          ['The market', 'Published as `@keicoin/market@0.4.0` and reached by a plain `bun add kei-transaction` at 0.8.0. Books rank cheapest asks and highest bids by exact cross-multiplied raw ratios, including asset decimal scaling; the public `unitPrice` and `spread` fields remain numbers for display and can tie after conversion. **Settling on the public testnet.** An offer locks the units at the ledger, a second sale of the same units is refused, and one accept moves both legs — measured against the node, then again over the public URL once the gateway was taught to forward `swap_info` and `account_swaps`.'],
          ['The mock chain', 'Available explicitly through `Kei.mock()` for deterministic tests, and used by the hosted demos. It enforces the real ledger rules — one chain per account, derived asset ids, receivable arrivals, work tiers, the issuance burn, supply caps, transfer policy, and the double-claim index.'],
          ['The node', 'The public node was rebuilt onto `master` on 3 August 2026 and reports `store_version 24`. Before that, a claims-or-swaps binary could not open a ledger written by an earlier one at all — the new tables were added to an existing store version instead of getting their own, and only a fresh database, which is all CI ever starts from, was unaffected.'],
          ['The network', 'One rate-limited, best-effort public dev-network node at `https://testnet.keicoin.org/rpc`. It has weak consensus, no uptime promise, published dev keys, and no monetary value. There is no mainnet.'],
          ['Wallets', 'Both merged. The in-game panel ships in `kei-transaction@0.8.0` (`@keicoin/wallet@0.5.0`); the standalone wallet, forked from BananoVault, is on [kei-wallet](https://github.com/keicoin-org/kei-wallet)’s default branch, and its market panel is wired to `kei.market` — it shows that wallet’s own offers, cancellable, and its settled trades. The network’s book stays unshowable: an offer lives on its author’s chain and Kei ships no indexer, so the panel says that rather than presenting a handful of offers as the market.'],
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
          '**The 0.8.0 SDK release is installable, and it reaches the whole registry.** Verified on 4 August 2026 against the published graph rather than read off a checkout: the umbrella resolves `@keicoin/market@0.4.0`, `@keicoin/player-economy@0.1.2`, `@keicoin/economy@0.2.2` and `@keicoin/claims@0.5.1`, alongside the other scoped packages. The `0.6.0` release was the first umbrella to close the split with the registry; `0.8.0` carries the coordinated market-safety graph and exact book ranking forward. Create Kei MMO is not released; npm still serves the superseded `create-kei-game@0.2.0` scaffolder, which is a different product.',
          '**No smart contract VM**, deliberately. If your design needs one, Kei is the wrong tool and this page would rather you found out here.',
        ],
      },
    ],
  },
]
