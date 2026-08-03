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
  '`Kei.start()` defaults to the public testnet, which since 3 August 2026 has been running a build that accepts M4 claim blocks and M5 swaps. It is still one rate-limited, best-effort dev node with weak consensus, published dev keys, and no uptime promise — not a distributed network. The API is real and now measured against that node, but **nothing on it holds value.**'

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
            '**The market is published as `@keicoin/market@0.1.0` and the public testnet settles swaps.** Measured on 3 August 2026 over `https://testnet.keicoin.org/rpc`: an offer locks the units at the ledger, a second sale of the same units is refused, one accept moves both legs, and the gateway now forwards the two read actions (`swap_info`, `account_swaps`) a market needs. See [status](/status).',
            '**Nobody can show you the whole book.** An offer lives on its author\'s chain and Kei ships no indexer, so a front end has to keep the list of accounts to read. That is bookkeeping about where to look, not about who owns what — `carpet-markets`\' registry is the worked example.',
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
            '**Its auction house now has the screen and the settlement underneath it.** Browse, Sell and Mine read listings from player chains; buying moves the item and gold in one settlement with the game server taking no part. The hall only knows accounts it has heard from, and equipping, loot and quest rewards still run on the upstream inventory tables.',
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
      { kind: 'prose', text: 'Kei has a **public testnet that carries M4 claims and M5 swaps**, measured on 3 August 2026 rather than inferred from CI. What you can install is version 0.3.0 of the SDK packages, and every `@keicoin/*` package with it. `master` has since moved to 0.4.0 and nobody has published it.' },
      {
        kind: 'table',
        head: ['', 'State'],
        rows: [
          ['The SDK', 'Version 0.3.0 is on npm, and every `@keicoin/*` package with it. Wallet, send, receive, issue, mint, burn, transfer, balanceOf, items, commit, claim, the market, and the in-game wallet panel ship with TypeScript types. Payment memos are not in the current wire contract; correlate purchases by payment hash.'],
          ['Installable vs merged', '`master` carries 0.4.0 — `@keicoin/market` 0.1.1, `create-kei-game` 0.2.0 — and none of it is published. Item stats, the roll-supply fix behind them, and the three scaffolder templates are merged and not installable. Publishing is a manual, owner-only step; until it is run, install 0.3.0 and read these pages against it.'],
          ['The mock chain', 'Available explicitly through `Kei.mock()` for deterministic tests and still used by some hosted demos. It enforces the real ledger rules — one chain per account, derived asset ids, receivable arrivals, work tiers, the issuance burn, supply caps, transfer policy, and the double-claim index.'],
          ['The node', 'The public node was rebuilt onto `master` on 3 August 2026 and reports `store_version 24`. Before that, an M4 or M5 binary could not open a ledger written by an M2 or M3 one at all — the new tables were added to an existing store version instead of getting their own, and only a fresh database, which is all CI ever starts from, was unaffected.'],
          ['The network', 'One rate-limited, best-effort public dev-network node at `https://testnet.keicoin.org/rpc`. It has weak consensus, no uptime promise, published dev keys, and no monetary value. There is no mainnet.'],
          ['The demo', 'Playable. Press a button, bank presses, claim them, buy upgrades that live on the ledger instead of in a save file.'],
          ['The market', 'Published as `@keicoin/market@0.1.0`, and **settling on the public testnet**. An offer locks the units at the ledger, a second sale of the same units is refused, and one accept moves both legs — measured against the node, then again over the public URL once the gateway was taught to forward `swap_info` and `account_swaps`. It could be written to and not read from until that landed.'],
          ['Wallets', 'Both merged. The in-game panel ships in `kei-transaction@0.3.0`; the standalone wallet, forked from BananoVault, is on [kei-wallet](https://github.com/keicoin-org/kei-wallet)’s default branch, and its market panel is now wired to `kei.market` — it shows that wallet’s own offers, cancellable, and its settled trades. The network’s book stays unshowable: an offer lives on its author’s chain and Kei ships no indexer, so the panel says so rather than presenting a handful of offers as the market.'],
          ['World of Wonder', 'Published as [world-of-wonder](https://github.com/keicoin-org/world-of-wonder) and hosted at [mmo.keicoin.org](https://mmo.keicoin.org). Gold and items are chain assets; the database keeps accounts, characters and positions. It settles on the public testnet by default, and `KEI_NETWORK=mock` runs it against a chain inside its own process. **The auction house is implemented end to end** — Browse, Sell and Mine sit over player-signed offers, atomic acceptance and cancellation, with a bounded server-side roster that only tells the client which chains to read.'],
          ['Carpet Markets', 'Playable at [/examples/carpet-markets](/examples/carpet-markets), and the worked demo of `@keicoin/market`. A coin launchpad where every trade is an offer one player wrote and another accepted, settled in one block, and where whether a market can exist at all is the coin’s transfer policy. It runs against an in-memory mock chain in a Durable Object, so the ledger resets when that object is evicted.'],
        ],
      },
      { kind: 'heading', text: 'What was measured, and when' },
      { kind: 'prose', text: 'This section used to say a public M4/M5 deployment was "not evidenced here", which was a polite way of saying nobody had checked. It was checked on 3 August 2026, from a clean `npm install kei-transaction` against `https://testnet.keicoin.org/rpc`.' },
      {
        kind: 'list',
        items: [
          '**Payments, automatic receive, issuance and its burn, mint and `balanceOf` all work** against the public node. Re-issuing the same symbol returns the same asset id; the issuer’s balance really does drop by 1 on its first asset.',
          '**`token.commit()` — M4 rooted claims — works.** The M4 conformance suite passes against the node: one issuer block, three player claims, correct balances, and a second claim from the same account refused.',
          '**`market.sell()` / `accept()` — M5 swaps — work**, and the whole flow passes over the public URL: offer, lock, refused double-sale, settlement.',
          '**The first rows of that list were `Block is invalid` the same morning**, on a node predating both block types. Evidence about a deployment is behavioural: `store_version` and a passing suite, not `build_info`, which is stamped at configure time and lied for several hours.',
          '**[The exact SDK suite](https://github.com/keicoin-org/kei-transaction/pull/9) is shared from a pinned revision**, so the node gate and the live check run the same contract. The pinned run: M2 11 pass, M4 2 pass, M5 3 pass.',
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
          'Assume `master` is what you installed. It is not — the registry is a release behind, and the gap is item stats, the roll-supply fix, and the scaffolder templates.',
        ],
      },
      { kind: 'prose', text: 'What you **can** do today is build against the published 0.3.0 API and a public testnet that carries claims and swaps, or keep tests deterministic with `Kei.mock()`.' },
      { kind: 'heading', text: 'Known and stated plainly' },
      {
        kind: 'list',
        items: [
          '**Network security.** The public testnet is one best-effort dev node with weak consensus, not a production network.',
          '**No inherited liquidity.** Kei launches with no users, no exchanges, and no market.',
          '**Timeline.** M3, M4 and M5 are live on the public testnet. M6 is merged in both wallets. M7 — the MMO template — now has its auction-house screen and its tested end-to-end settlement; the remaining upstream inventory paths are stated separately rather than hidden inside that milestone.',
          '**What is installable is a release behind what is merged.** 0.3.0 on npm, 0.4.0 on `master`, and publishing is a manual step somebody has to run.',
          '**No smart contract VM**, deliberately. If your design needs one, Kei is the wrong tool and this page would rather you found out here.',
        ],
      },
    ],
  },
]
