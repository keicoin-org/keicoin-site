import { strict as assert } from 'node:assert'

import { Kei, randomSeed } from 'kei-transaction'

const node = await Kei.mock()
const game = await Kei.server({ seed: 'E'.repeat(64), node })
await game.faucet(20_000)

const potion = await game.token.issue({ name: 'Potion', symbol: 'POTION', decimals: 0, transfer: 'open' })
const sword = await game.items.create({ name: 'Sword of Testing', symbol: 'SWORD' })

// What this world deals in. The catalogue names things; it decides nothing
// about ownership or price, and an asset missing from it still trades.
const wares = [
  { key: 'potion', asset: potion.id, title: 'Potion' },
  { key: 'sword', asset: sword.id, title: 'Sword of Testing' },
]

const seller = await Kei.start({ node, seed: randomSeed(), shop: { catalogue: wares }, autoCancelExpired: false })
const buyer = await Kei.start({ node, seed: randomSeed(), shop: { catalogue: wares }, autoCancelExpired: false })
await Promise.all([game.send(seller.address, 100), game.send(buyer.address, 1_000)])
await potion.mint(seller.address, 10)
await game.items.mint(sword.id, seller.address)
await Promise.all([seller.sync(), buyer.sync()])

const gameKeiBefore = await game.balance()

// The player's own key signs the listing, and the ledger locks the units.
const listing = await seller.shop.list({ item: 'potion', qty: 2, each: 120 })
assert.equal(listing.qty, 2)
assert.equal(listing.each, 120)
assert.equal(listing.price, 240) // The lot price, not the unit price.
assert.equal(listing.mine, true)
assert.equal(listing.life, 'live')

// The lock is the ledger's, not the SDK's: the two units leave the seller's
// balance the moment the offer block is signed, so nothing can spend them twice.
const sellerPotions = await seller.shop.funds('potion')
assert.equal(sellerPotions.confirmed, 8)
assert.equal(sellerPotions.spendable, 8)

// There is no shop anywhere: browsing is a read of the chains this wallet knows
// about, and `coverage` says so rather than presenting a roster as the market.
const shelves = await buyer.shop.browse({ from: seller.address })
assert.equal(shelves.listings.length, 1)
assert.equal(shelves.listings[0]?.hash, listing.hash)
assert.equal(shelves.listings[0]?.mine, false)
assert.equal(shelves.coverage.asked, 1)
assert.equal(shelves.coverage.read, 1)
// Complete only because this walk named one account and that account answered.
// A browse over a roster is normally a floor, and says so here.
assert.equal(shelves.coverage.complete, true)

// One block, both legs or neither. The listing is re-read and verified before
// anything is signed.
const purchase = await buyer.shop.buy(shelves.listings[0]!)
assert.equal(purchase.received.qty, 2)
assert.equal(purchase.paid.amount, 240)

await Promise.all([seller.sync(), buyer.sync()])
assert.equal((await buyer.shop.funds('potion')).confirmed, 2)
assert.equal((await seller.shop.funds('potion')).confirmed, 8)
assert.equal(await buyer.balance(), 760)
assert.equal(await seller.balance(), 340)

// The lot is gone from the ledger, so taking it twice is refused there rather
// than hidden by a stale screen.
await assert.rejects(() => buyer.shop.buy(listing))

// Only the author can cancel, because only their asset is locked.
const swordListing = await seller.shop.list({ item: 'sword', each: 500 })
assert.equal(await seller.items.owner(sword.id), null) // Locked by the offer.
await assert.rejects(() => buyer.shop.cancel(swordListing))
await seller.shop.cancel(swordListing)
assert.equal(await seller.items.owner(sword.id), seller.address)

// A gift is a transfer, not an offer: no price, no accept, and no memo — a
// Kei block has nowhere to put one.
const gift = await seller.shop.gift({ to: buyer.address, item: 'sword' })
assert.equal(gift.amount, 1)
await buyer.sync()
assert.equal(await buyer.items.owner(sword.id), buyer.address)

// The game issued the assets and then held none of the trade: no custody, no
// escrow account, and no Kei of the sale.
assert.equal(await game.balance(), gameKeiBefore)
assert.equal(await potion.balanceOf(game.address), 0)

console.log(
  JSON.stringify({
    kind: 'shop',
    lotPrice: listing.price,
    unitPrice: listing.each,
    buyerPotions: 2,
    sellerKei: 340,
    gameKeiUnchanged: true,
    coverageComplete: shelves.coverage.complete,
  }),
)
