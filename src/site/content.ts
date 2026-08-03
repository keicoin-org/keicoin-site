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

const NEXT_STEPS = {
  kind: 'next' as const,
  links: [
    { href: '/examples/button', label: 'Play the demo', note: 'The whole SDK, running, in a browser tab.' },
    { href: '/docs', label: 'Read the quickstart', note: 'Install to a confirmed payment, in about sixty seconds.' },
    { href: '/status', label: 'Check what actually works', note: 'Written down honestly, milestone by milestone.' },
  ],
}

const MOCK_CAVEAT =
  '`Kei.start()` now defaults to a public testnet instead of the old in-memory mock — but that testnet is one rate-limited, best-effort dev node with weak consensus, not a distributed network. M4 (commit, claim, commit_close) is merged and CI-gated on kei-node; that is evidence about the code, not about which build the public testnet is running. The API is real, but **nothing on it holds value.**'

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
            '**The market is merged and published as `@keicoin/market@0.1.0`, but no public node runs it yet.** Offers and atomic settlement (`swap_offer`/`swap_accept`/`swap_cancel`) are native on `kei-node` and gated in its CI; the best-effort testnet endpoint is not claimed to be carrying them. See [status](/status).',
            MOCK_CAVEAT,
            'A market only exists for tokens issued `transfer: "open"`. That is a decision you make once, at issuance, and cannot reverse.',
            'There is no order book or matching engine in the protocol, and there will not be. Offers are individual blocks; a front end aggregates them.',
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
        {
          kind: 'limits',
          items: [
            MOCK_CAVEAT,
            'You must deliver the proof to the player yourself. The chain stores a root, not a list of who is owed what — that is the whole reason it is cheap.',
            'One entitlement per account per root. Two rewards for the same player in one batch merge into one leaf.',
            'A claim is a block, so a player who never comes back never claims. Budget for unclaimed drops rather than assuming delivery.',
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
    path: '/docs',
    title: 'Quickstart and API — Kei',
    heading: 'Install to a confirmed payment',
    summary:
      'The whole surface fits on one page. No signup, no API key, no dashboard, no wallet extension, and no interactive prompt anywhere.',
    blocks: [
      { kind: 'code', caption: 'Install', code: `bun add kei-transaction     # or npm / pnpm / yarn` },
      { kind: 'prose', text: 'ESM, TypeScript types included, runs in a browser and in Node or Bun.' },
      { kind: 'heading', text: 'Two entry points, because a key signs only for its own account' },
      { kind: 'code', caption: 'The distinction the whole SDK is built on', code: `Kei.start()    // PLAYER — browser. Holds the player's seed.
Kei.server()   // ISSUER — Node/Bun only. Holds the game's seed.` },
      { kind: 'prose', text: '`Kei.server()` refuses to run if it detects a browser, and says why. An issuer seed in the client is a total compromise of your economy: anyone can mint your currency without limit.' },
      { kind: 'heading', text: 'Wallet' },
      { kind: 'code', code: `kei.address                        // 'kei_3abc...'
await kei.balance()                // 12.5 — a number, in Kei
await kei.send(toAddress, amount)  // { hash, amount, to }
await kei.faucet()                 // testnet only; throws on mainnet
kei.seed                           // export for backup; never logged

kei.on('received', tx => {})
await kei.wallet.summary()         // { address, kei, tokens, items, pending }` },
      { kind: 'heading', text: 'Tokens' },
      { kind: 'code', caption: 'Issuer', code: `const gems = await game.token.issue({ name: 'Gems', symbol: 'GEM', decimals: 0 })
await gems.mint(playerAddress, 500)
await gems.burn(500)
await gems.balanceOf(address)
const drop = await gems.commit([{ to: playerA, amount: 500 }])` },
      { kind: 'code', caption: 'Player', code: `const gems = await kei.token('GEM', issuerAddress)
await gems.balance()
await gems.transfer(to, 120)       // no 'from' — the signer is the sender
await kei.claims.pending()` },
      { kind: 'heading', text: 'Errors are sentences that state their own fix' },
      { kind: 'code', code: `Not enough Kei — balance is 0.4, tried to send 1.2.` },
      { kind: 'prose', text: 'Because the reader is often an agent, and it cannot ask a follow-up question.' },
      { kind: 'heading', text: 'The full reference' },
      { kind: 'prose', text: 'This page is a summary and the package is the source of truth. For agents, [/llms.txt](/llms.txt) is the same surface compressed, and [/AGENTS.md](/AGENTS.md) is the integration procedure with the failure modes named.' },
      {
        kind: 'next',
        links: [
          { href: '/examples/button', label: 'The demo, running', note: 'Every primitive on this page, in a browser tab.' },
          { href: '/status', label: 'What works today', note: 'And what is scheduled rather than shipped.' },
        ],
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
      { kind: 'prose', text: 'Kei has a **public M3 testnet and merged native M4 claims**. Version 0.3.0 of the SDK packages is published, and every `@keicoin/*` package with it. `Kei.start()` defaults to the best-effort public testnet; the node gate runs the pinned SDK-owned M2 and M4 contracts against a clean native startup.' },
      {
        kind: 'table',
        head: ['', 'State'],
        rows: [
          ['The SDK', 'Version 0.3.0 is published, and every `@keicoin/*` package with it. Wallet, send, receive, issue, mint, burn, transfer, balanceOf, items, commit, claim, the market, and the in-game wallet panel ship with TypeScript types. Payment memos are not in the current wire contract; correlate purchases by payment hash.'],
          ['The mock chain', 'Available explicitly through `Kei.mock()` for deterministic tests and still used by some hosted demos. It enforces the real ledger rules — one chain per account, derived asset ids, receivable arrivals, work tiers, the issuance burn, supply caps, transfer policy, and the double-claim index.'],
          ['The node', 'Builds, starts, and serves RPC on Linux CI. M2 asset operations and native M4 commit, claim, commit-close, commit-info, and claim-status pass the SDK-owned contracts against a clean startup. Dev genesis has the fixed allocation; beta/live still require their offline ceremonies.'],
          ['The network', 'One rate-limited, best-effort public dev-network node at `https://testnet.keicoin.org/rpc`. It has weak consensus, no uptime promise, published dev keys, and no monetary value. There is no mainnet.'],
          ['The demo', 'Playable. Press a button, bank presses, claim them, buy upgrades that live on the ledger instead of in a save file.'],
          ['The market', 'Merged on the node and the SDK, and published as `@keicoin/market@0.1.0`. Swap offer/accept/cancel, atomic settlement, and price history. What is not claimed: a public node deployment carrying the native swap blocks.'],
          ['Wallets', 'Both merged. The in-game panel ships in `kei-transaction@0.3.0`; the standalone wallet, forked from BananoVault, is on [kei-wallet](https://github.com/keicoin-org/kei-wallet)’s default branch. The standalone wallet’s market panel still reports itself unavailable — it was written while `@keicoin/market` was unpublished, and is simply not wired up yet.'],
          ['World of Wonder', 'Published as [world-of-wonder](https://github.com/keicoin-org/world-of-wonder) and hosted at [mmo.keicoin.org](https://mmo.keicoin.org). Gold and items are chain assets; the database keeps accounts, characters and positions. It settles on the public testnet by default, and `KEI_NETWORK=mock` runs it against a chain inside its own process.'],
          ['Carpet Markets', 'Published as [carpet-markets](https://github.com/keicoin-org/carpet-markets) — a coin launchpad where a coin’s ruggability is its deed’s transfer policy. Runs locally against an in-memory mock, with the curve and the whole economy under test. Its Cloudflare Worker is written but not yet deployed, so there is no hosted copy on this domain.'],
        ],
      },
      { kind: 'heading', text: 'M3 and M4 evidence' },
      { kind: 'prose', text: 'M3 runs the same SDK contract through the public HTTPS boundary. M4 adds native commit, claim, and commit-close, and the node gate runs the SDK-owned M4 contract against a clean startup.' },
      {
        kind: 'list',
        items: [
          '**[The exact SDK suite](https://github.com/keicoin-org/kei-transaction/pull/9) is shared from a pinned revision.** All 10 M2 tests pass live against the node with only the URL changed.',
          '**[The development reserve ceremony](https://github.com/keicoin-org/kei-node/pull/12) is deterministic and tested.** Dev genesis creates the fixed 900B reserve and four allocations totalling 100B without giving the reserve voting weight.',
          '**[The node acceptance gate](https://github.com/keicoin-org/kei-node/pull/13) is merged and enforced.** Both final CI runs passed; the native gate covers 46 core tests in eight suites, including five reserve tests and the ingress regression, plus the separate RPC history test.',
          '**[The M4 node contract is pinned in CI](https://github.com/keicoin-org/kei-node).** Native `commit`, `claim`, `commit_close`, `commit_info`, and `claim_status` are merged and exercised against a clean node startup.',
          '**The public endpoint is M3 evidence, not proof of an M4 deployment.** The repository gate proves compatibility; this page does not claim the public node has been redeployed with M4 until that is separately recorded.',
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
          'Read "the market is published" as "a public node will settle a swap for you". `@keicoin/market` is on npm and the swap blocks are native in `kei-node`, but no deployment of the public endpoint carrying them is claimed here.',
        ],
      },
      { kind: 'prose', text: 'What you **can** do today is build against the published API and the public M3 testnet, or keep tests deterministic with `Kei.mock()`. Native M4 claims are merged and gated, while a public M4 deployment remains a separately evidenced step.' },
      { kind: 'heading', text: 'Known and stated plainly' },
      {
        kind: 'list',
        items: [
          '**Network security.** The public testnet is one best-effort dev node with weak consensus, not a production network.',
          '**No inherited liquidity.** Kei launches with no users, no exchanges, and no market.',
          '**Timeline.** M3 is public. Native M4 claims and M5 swaps are merged and CI-gated, and M5 and M6 are published on npm. What no milestone here claims is a public node redeployed with either.',
          '**No smart contract VM**, deliberately. If your design needs one, Kei is the wrong tool and this page would rather you found out here.',
        ],
      },
    ],
  },

  {
    path: '/examples',
    title: 'Examples — Kei',
    heading: 'Examples',
    summary:
      'Three games, each one making a different argument for putting an economy on a chain. All of them run, all of them are readable, and none of them hold value.',
    blocks: [
      {
        kind: 'prose',
        text: 'They are ordered by how much they ask of you. **Button** is the SDK in one tab. **Carpet Markets** is what happens when players can issue things. **World of Wonder** is a real game with the economy replaced, and the one to fork if you are shipping something.',
      },
      {
        kind: 'prose',
        text: 'You do not have to clone any of them by hand. Each is a template the scaffolder writes for you, renamed and with your own currency already in it:',
      },
      {
        kind: 'code',
        code: `npm create kei-game my-game                                    # star-clicker, the default
npm create kei-game my-mmo -- --template world-of-wonder
npm create kei-game my-launchpad -- --template carpet-markets`,
      },
      {
        kind: 'next',
        links: [
          {
            href: '/examples/button',
            label: 'Button — a 3D clicker with a real economy',
            note: 'Press a green button, bank the presses into one on-chain batch, claim them, and buy upgrades that are items in your wallet. Babylon.js, no database, no save file.',
          },
          {
            href: 'https://github.com/keicoin-org/carpet-markets',
            label: 'Carpet Markets — a coin launchpad where the rug is a mechanic',
            note: 'Launch a coin, trade it on a bonding curve, and read the deed before you buy: whether a coin can be rugged is a transfer policy the chain enforces, not a promise anybody makes.',
          },
          {
            href: 'https://mmo.keicoin.org',
            label: 'World of Wonder — a multiplayer RPG whose gold is not in its database',
            note: 'A Babylon.js and Colyseus RPG with movement, combat, quests and a vendor, forked so that gold and items are chain assets instead of rows. Fork it and you have a game where a sword is the player’s.',
          },
        ],
      },

      { kind: 'heading', text: 'Button' },
      {
        kind: 'prose',
        text: 'A green button on a pole. It is deliberately a clicker: the loop is legible in three seconds, and it exercises every primitive in the SDK without anybody having to invent a reason. [Play it](/examples/button), or read [the source](https://github.com/keicoin-org/button).',
      },
      {
        kind: 'table',
        head: ['Primitive', 'Where it shows up'],
        rows: [
          ['issue', 'The game creates its coin on startup'],
          ['commit / claim', 'Banked presses become one issuer block; your wallet writes the claim'],
          ['transfer', 'You pay the shopkeeper in coins, signed by you'],
          ['mint', 'The shopkeeper delivers the upgrade — only once the chain says the coins landed'],
          ['items', 'Every upgrade is a supply-N item in your wallet'],
          ['balanceOf', 'The screen on the pole, and the price check in the shop'],
          ['pay', 'The optional exchange desk: Kei in, coins out'],
        ],
      },
      { kind: 'prose', text: 'The source is the documentation. It is written to be read, and the interesting file is the one holding every line of Kei in the client — about two hundred lines, comments included.' },

      { kind: 'heading', text: 'Carpet Markets' },
      {
        kind: 'prose',
        text: 'The pump.fun shape: anybody launches a coin, it trades against a bonding curve, and it either graduates or dies. It exists to make one argument, which is the argument a database cannot make.',
      },
      {
        kind: 'prose',
        text: 'Every coin has a **deed** — one item, minted to whoever launched it. Holding the deed is the authority to take the reserve, and taking the reserve means sending the deed back to the market. So *"can this coin be rugged?"* is not a promise the operator makes. It is the deed’s `transfer` policy, chosen at launch and immutable afterwards:',
      },
      {
        kind: 'table',
        head: ['The deed', 'Issued as', 'What it means'],
        rows: [
          ['Carpet', '`transfer: \'open\'`', 'It can be sent back, so the reserve can be taken. Probably will be.'],
          ['Nailed down', '`transfer: \'none\'`', 'Soulbound. There is no message anybody can sign that moves the reserve out.'],
        ],
      },
      {
        kind: 'prose',
        text: 'A database can hold the same flag, and a developer can edit the row. That is the entire difference, and it is why the rug is a mechanic in this game rather than a warning printed above one: a player can read the badge, buy the carpet coin anyway, watch the creator empty it, and check afterwards that the chain said so the whole time.',
      },
      {
        kind: 'prose',
        text: 'It also puts a number on the issuance burn. A launch issues two assets, the coin and its deed, and the nth asset an account issues burns n Kei — so **every launch costs more than the last one, forever**. The first is about 3 Kei; the fiftieth is over a hundred. That is the only spam limit that works on keypairs anybody can generate by the million.',
      },
      {
        kind: 'prose',
        text: 'The economy tests assert the badge at the ledger rather than in the app: a soulbound deed cannot be sent back, a transferable one pays its holder the whole reserve, and a holder of a rugged coin still holds every coin they bought — because they always did, and owning them never meant they were worth anything.',
      },

      { kind: 'heading', text: 'World of Wonder' },
      {
        kind: 'prose',
        text: 'A fork of [`orion3dgames/t5c`](https://github.com/orion3dgames/t5c) — a real Babylon.js and Colyseus RPG with movement, combat, quests, loot, a navmesh, a vendor and a UI. All of that is upstream’s work and still is. What the fork replaces is the economy.',
      },
      {
        kind: 'table',
        head: ['', 'Upstream', 'Here'],
        rows: [
          ['Gold', '`PlayerSchema.gold`, saved to SQLite', 'A Kei token. `balanceOf` is the only source of truth.'],
          ['Inventory', '`character_inventory` rows', 'One asset per item archetype; owning a sword is holding a unit of it.'],
          ['Buying', 'The server decrements gold and adds a row', 'The player signs a transfer; the issuer mints after the chain confirms it.'],
          ['The bag panel', 'Reads `PlayerSchema.inventory`', 'Reads the player’s on-chain balances.'],
        ],
      },
      {
        kind: 'prose',
        text: 'The database is still there, deliberately: it holds accounts, characters, and where they were standing, and Colyseus is still authoritative over presence and position. Neither is authoritative over money, which is the whole point. It is the example to start from if you are building something rather than reading something.',
      },

      { kind: 'heading', text: 'What none of them are' },
      {
        kind: 'limits',
        items: [
          'Nothing in any of them holds value, and that is a design constraint rather than a disclaimer. There is no mainnet.',
          'The hosted copies run against mock chains that reset when the process or the Durable Object holding them goes away. They are demos, not services.',
          'Button counts its own presses, because in single-player nothing else can see them. That is a real trust hole with a ceiling on it, written down in the source rather than hidden.',
          'Carpet Markets has one open quote per address, because a Kei transfer carries no memo and an arriving payment says only who sent it and how much. Two browser tabs racing is a thing you can do to yourself.',
          'Carpet Markets is a satire of a real pattern that has taken real money from real people. It is worth playing precisely because the coins are worthless; it is not worth copying anywhere they are not.',
        ],
      },
      {
        kind: 'next',
        links: [
          { href: '/docs', label: 'Read the quickstart', note: 'Install to a confirmed payment, in about sixty seconds.' },
          { href: '/status', label: 'What actually works', note: 'And what is scheduled rather than shipped.' },
        ],
      },
    ],
  },
]
