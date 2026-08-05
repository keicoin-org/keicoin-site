/**
 * The chart path, against the published package.
 *
 * A chart is the one market read where the distance between "this ran" and
 * "this is the market" is largest, so this file is written to measure both. It
 * settles three trades at three prices, draws them, and then asks the two
 * questions a renderer has to answer before it puts a line on a screen: which
 * accounts did the walk actually read, and how good is the ordering it used.
 *
 * It also asserts what is *not* here. `history`, `ohlc`, `ticker` and `chart`
 * are compatibility wrappers on `kei-transaction`'s master branch and are not
 * in any published package, because publication is frozen behind
 * kei-transaction#107. A page that names them would be describing a branch. The
 * day they publish, the refusal at the bottom of this file fails and the page
 * that embeds it is the thing to rewrite.
 */

import { strict as assert } from 'node:assert'

import { Kei, randomSeed } from 'kei-transaction'

const node = await Kei.mock()
const game = await Kei.server({ seed: 'F'.repeat(64), node })
await game.faucet(20_000)

const ore = await game.token.issue({ name: 'Ore', symbol: 'ORE', decimals: 0, transfer: 'open' })

const alice = await Kei.start({ node, seed: randomSeed(), autoCancelExpired: false })
const bob = await Kei.start({ node, seed: randomSeed(), autoCancelExpired: false })
const buyer = await Kei.start({ node, seed: randomSeed(), autoCancelExpired: false })

await Promise.all([game.send(alice.address, 100), game.send(bob.address, 100), game.send(buyer.address, 1_000)])
await Promise.all([ore.mint(alice.address, 20), ore.mint(bob.address, 10)])
await Promise.all([alice.sync(), bob.sync(), buyer.sync()])

// Three settled trades at three prices. `price` on a listing is the total ask;
// `Offer.price` comes back per unit, which is what a chart plots.
const cheap = await alice.market.sell({ asset: ore, amount: 10, price: 20 })
assert.equal(cheap.price, 2)
await buyer.market.accept(cheap)

const middle = await alice.market.sell({ asset: ore, amount: 10, price: 30 })
assert.equal(middle.price, 3)
await buyer.market.accept(middle)

const dear = await bob.market.sell({ asset: ore, amount: 10, price: 50 })
assert.equal(dear.price, 5)
await buyer.market.accept(dear)

await Promise.all([alice.sync(), bob.sync(), buyer.sync()])

// `series()` is one trade read, ordered and ready to draw. `trades()` defaults
// to this wallet's own chain, and the buyer was a party to all three.
const series = await buyer.market.series({ asset: ore })
assert.equal(series.points.length, 3)
assert.deepEqual(
  series.points.map((point) => point.price).sort((a, b) => a - b),
  [2, 3, 5],
)

// Ordering is the honest part. There is no clock in consensus, so the only
// order available across two chains is the node's own first-seen time, and the
// series says so in a field rather than in a comment.
assert.equal(series.ordering.by, 'advisory-time')
assert.equal(series.summary?.median, 3)
assert.equal(series.summary?.low, 2)
assert.equal(series.summary?.high, 5)
assert.equal(series.summary?.volume, 30)
assert.equal(series.summary?.trades, 3)

// Candles are the same trades with a bucket around them. The values inside a
// bucket are exact; which trades land in which bucket is advisory.
const candles = await buyer.market.candles({ asset: ore, every: '1d' })
assert.equal(candles.length, 1)
assert.equal(candles[0]?.high, 5)
assert.equal(candles[0]?.low, 2)
assert.equal(candles[0]?.volume, 30)
assert.equal(candles[0]?.trades, 3)

// Coverage answers one question and not the other. It says the accounts this
// walk named answered — never that the accounts it named were the market.
assert.equal(series.coverage?.complete, true)
assert.equal(candles.coverage.complete, true)

// The same asset, read from one seller instead of both: still a complete walk,
// and a strictly smaller history. This is what a partial read looks like when
// nothing failed, and it is why `complete: true` is not "this is the market".
const narrow = await buyer.market.series({ asset: ore, from: alice.address })
assert.equal(narrow.coverage?.complete, true)
assert.equal(narrow.points.length, 2)
assert.equal(narrow.summary?.high, 3)

// `medianPrice()` is a scalar and cannot carry any of that.
assert.equal(await buyer.market.medianPrice(ore), 3)

// Where to verify a trade rather than infer it: the offer block itself.
assert.equal((await buyer.market.get(dear.hash))?.state, 'accepted')
assert.equal(buyer.market.lifeOf((await buyer.market.get(dear.hash))!), 'taken')

// One walk, every traded asset — instead of one walk per asset on a board.
const prices = await buyer.market.prices()
assert.equal(prices.get(ore.id)?.median, 3)

// The compatibility names, which this package does not have. Publication is
// frozen (kei-transaction#107), so a page that documented them would be
// documenting a branch.
const market = buyer.market as unknown as Record<string, unknown>
const unpublished = ['history', 'ohlc', 'ticker', 'chart'].filter(
  (name) => typeof market[name] === 'function',
)
assert.deepEqual(unpublished, [])

console.log(
  JSON.stringify({
    kind: 'market-chart',
    points: series.points.length,
    prices: series.points.map((point) => point.price).sort((a, b) => a - b),
    median: series.summary?.median,
    volume: series.summary?.volume,
    ordering: series.ordering.by,
    candles: candles.length,
    coverageComplete: series.coverage?.complete,
    narrowPoints: narrow.points.length,
    unpublishedAliases: ['history', 'ohlc', 'ticker', 'chart'],
  }),
)
