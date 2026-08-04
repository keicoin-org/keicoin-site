/**
 * The one playground on this site that uses the network.
 *
 * Every other file in this directory runs against `Kei.mock()` and proves the
 * protocol shape in one process. None of them can prove that the public node
 * behaves the same way — and on one point it does not, which is why this file
 * exists and why its assertions are written against what the node actually
 * returns rather than what the mock returns.
 *
 *   bun run docs/playgrounds/testnet-live.ts
 *
 * It creates fresh throwaway accounts, faucets them on the dev network, and
 * publishes real blocks to https://testnet.keicoin.org/rpc. That node is one
 * rate-limited best-effort dev node with published dev keys and no monetary
 * value, so the units below are worth nothing and the run may fail for reasons
 * that are not your integration's fault. It exits nonzero on any failed
 * assertion.
 */
import { strict as assert } from 'node:assert'

import { Kei, KeiError, randomSeed } from 'kei-transaction'

const NODE = 'https://testnet.keicoin.org/rpc'

async function refusal(work: () => Promise<unknown>): Promise<KeiError> {
  let refused: unknown
  try {
    await work()
  } catch (error) {
    refused = error
  }
  assert.ok(refused instanceof KeiError, 'expected a KeiError refusal')
  return refused
}

const game = await Kei.server({ seed: randomSeed(), node: NODE })
assert.equal(game.network, 'testnet')
await game.faucet(50)

// ---------------------------------------------------------------------------
// A rooted claim batch, over the public URL.
// ---------------------------------------------------------------------------

const gems = await game.token.issue({
  name: 'Live Gems',
  symbol: 'LGEM',
  decimals: 0,
  maxSupply: 100,
  transfer: 'open',
  swap: 'off',
})

const alice = await Kei.start({ seed: randomSeed(), node: NODE })
const bob = await Kei.start({ seed: randomSeed(), node: NODE, autoClaim: false })

const drop = await gems.commit([
  { to: alice.address, amount: 7 },
  { to: bob.address, amount: 5 },
])

// The node, not the SDK, is echoing the published root back.
const published = await game.client.node.commitInfo(drop.root)
assert.equal(published?.issuer, game.address)
assert.equal(published?.count, 2)
assert.equal(published?.total, '12')
assert.equal(published?.closed, false)

const [claim] = await alice.claims.add(drop.proofFor(alice.address))
assert.equal(claim?.amount, 7)
assert.equal(await (await alice.token('LGEM', game.address)).balance(), 7)

// A second claim is refused. Note the code: the public node refuses the write
// with `node-error` and puts the reason in the message. `Kei.mock()` returns
// the granular `already-claimed` for the same attempt. Branch on `node-error`
// plus a fresh read of ledger state, never on the granular code alone.
const duplicate = await refusal(() => alice.claims.claim(drop.proofFor(alice.address)))
assert.equal(duplicate.code, 'node-error')
assert.match(duplicate.message, /already claimed from that root/)

await gems.close(drop.root)
assert.equal((await game.client.node.commitInfo(drop.root))?.closed, true)

const closed = await refusal(() => bob.claims.claim(drop.proofFor(bob.address)))
assert.equal(closed.code, 'node-error')
assert.match(closed.message, /closed and accepts no further claims/)

// ---------------------------------------------------------------------------
// One atomic swap, over the public URL.
// ---------------------------------------------------------------------------

const seller = await Kei.start({ seed: randomSeed(), node: NODE, autoCancelExpired: false })
const buyer = await Kei.start({ seed: randomSeed(), node: NODE, autoCancelExpired: false })
const bystander = await Kei.start({ seed: randomSeed(), node: NODE, autoCancelExpired: false })
await game.send(seller.address, 5)
await game.send(buyer.address, 10)
await Promise.all([seller.sync(), buyer.sync()])

const sword = await game.items.create({ name: 'Sword of Live Testing' })
await game.items.mint(sword.id, seller.address)
await seller.sync()
assert.equal(await game.items.owner(sword.id), seller.address)

const offer = await seller.market.sell({ asset: sword, price: 3 })
// The ledger holds the item while the offer stands. The seller cannot sell it
// twice and does not have to be trusted not to.
assert.equal(await game.items.owner(sword.id), null)

// Discovery is account-scoped. There is no global order book and no indexer:
// `offers()` reads the chains you name, and this one names the seller.
const listed = await buyer.market.offers({ from: seller.address })
assert.equal(listed.length, 1)
assert.equal(listed[0]?.hash, offer.hash)

const settlement = await buyer.market.accept(offer)
await Promise.all([buyer.sync(), seller.sync()])
assert.equal(settlement.price, 3)
assert.equal(await buyer.items.owner(sword.id), buyer.address) // one leg
assert.equal(await buyer.balance(), 7) // the other leg, same accept
assert.equal(await seller.balance(), 8)
assert.equal((await seller.market.get(offer.hash))?.state, 'accepted')

// This one is a client-side refusal from a fresh read of the offer, so it is
// the same stable code the mock gives.
const taken = await refusal(() => bystander.market.accept(offer))
assert.equal(taken.code, 'offer-taken')

// So is the memo refusal: `pay({ memo })` never reaches the wire.
const memo = await refusal(() => buyer.pay({ to: game.address, amount: 0.001, memo: 'order-1' }))
assert.equal(memo.code, 'no-memo-yet')

game.close()
alice.close()
bob.close()
seller.close()
buyer.close()
bystander.close()

console.log(JSON.stringify({
  kind: 'testnet-live',
  node: NODE,
  network: game.network,
  claimRoot: { published: true, count: published?.count, claimed: claim?.amount, closed: true },
  refusals: {
    duplicateClaim: duplicate.code,
    closedRoot: closed.code,
    secondAccept: taken.code,
    paymentMemo: memo.code,
  },
  swap: { price: settlement.price, buyerOwnsItem: true, buyerKei: 7, sellerKei: 8 },
}))
