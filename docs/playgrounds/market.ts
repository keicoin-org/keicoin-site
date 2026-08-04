import { strict as assert } from 'node:assert'

import { Kei, randomSeed } from 'kei-transaction'

const node = await Kei.mock()
const game = await Kei.server({ seed: 'C'.repeat(64), node })
await game.faucet(20_000)

const seller = await Kei.start({ node, seed: randomSeed(), autoCancelExpired: false })
const buyer = await Kei.start({ node, seed: randomSeed(), autoCancelExpired: false })
await Promise.all([game.send(seller.address, 2_000), game.send(buyer.address, 2_000)])
await Promise.all([seller.sync(), buyer.sync()])

const sword = await game.items.create({ name: 'Sword of Testing' })
await game.items.mint(sword.id, seller.address)
await seller.sync()

const offer = await seller.market.sell({ asset: sword, price: 5 })
assert.equal(await seller.items.owner(sword.id), null) // The ledger locks it.

const [listing] = await buyer.market.offers({ from: seller.address })
assert.equal(listing?.hash, offer.hash)

const settlement = await buyer.market.accept(offer)
assert.equal(await buyer.items.owner(sword.id), buyer.address)
assert.equal(await buyer.balance(), 1_995)
assert.equal(await seller.market.medianPrice(sword), 5)
const settled = await seller.market.get(offer.hash)
assert.equal(settled?.state, 'accepted')

console.log(
  JSON.stringify({
    kind: 'market',
    offer: settled?.state,
    price: settlement.price,
    buyerOwnsItem: true,
  }),
)
