import { strict as assert } from 'node:assert'

import { Kei, defineDropTable, randomSeed } from 'kei-transaction'

const node = await Kei.mock()
const game = await Kei.server({ seed: 'D'.repeat(64), node })
await game.faucet(20_000)

const gold = await game.token.issue({ name: 'Gold', symbol: 'GOLD', decimals: 0, transfer: 'open' })
const sword = await game.items.create({ name: 'Founder Sword', symbol: 'SWORD' })

// The declaration both halves of the game import. It reads no chain and signs
// nothing, so the player's copy of the odds is not a copy the server sent them.
const dragonHoard = defineDropTable({
  id: 'dragon-hoard',
  drops: [
    { asset: { symbol: 'GOLD' }, amount: 50, weight: 60 },
    { asset: { symbol: 'SWORD' }, weight: 10 },
  ],
  nothing: 30,
  issuer: game.address,
})

// The odds are derived from the weights rather than declared: 60, 10 and 30
// over a total of 100, with the `nothing` row last.
assert.deepEqual(dragonHoard.odds.map((row) => row.chance), [0.6, 0.1, 0.3])
assert.equal(dragonHoard.odds.at(-1)?.drop, null)

// The browser registers the same table, so it can check that a batch really was
// published for the odds it was shown before it claims anything.
const start = () => Kei.start({ node, seed: randomSeed(), tables: [dragonHoard] })
const goldPlayer = await start()
const swordPlayer = await start()
const unluckyPlayer = await start()
const party = [goldPlayer.address, swordPlayer.address, unluckyPlayer.address]

// A fixed roll per player, in order, so this file can assert exact awards. A
// game leaves `random` alone and gets the platform CSPRNG.
const rolls = [0.1, 0.65, 0.95]
let rolled = 0
const drop = await game.economy.drop(dragonHoard, party, { random: () => rolls[rolled++]! })

// One commit block per asset in the batch, however many players rolled it —
// not one mint per player.
assert.equal(drop.roots.length, 2)
assert.equal(drop.awarded, 2)
assert.equal(drop.awardFor(unluckyPlayer.address), null) // A miss is an outcome, not an error.

const goldAward = drop.awardFor(goldPlayer.address)
assert.ok(goldAward)

// The player checks the award against the table they were shown, before signing.
const verified = await goldPlayer.economy.verifyDrop(goldAward)
assert.equal(verified.symbol, 'GOLD')
assert.equal(verified.quantity, 50)
assert.equal(verified.chance, 0.6)

// A table rewritten after the batch was published hashes to a different digest,
// and no nonce recovers the salt inside a root that is already on the ledger.
const rewritten = defineDropTable({
  id: 'dragon-hoard',
  drops: [
    { asset: { symbol: 'GOLD' }, amount: 50, weight: 95 },
    { asset: { symbol: 'SWORD' }, weight: 5 },
  ],
  nothing: 0,
  issuer: game.address,
})
await assert.rejects(() => goldPlayer.economy.verifyDrop(goldAward, rewritten), { code: 'table-changed' })

// A table naming a bare symbol with no issuer is refused rather than checked
// against whichever account turned up: letting the batch name its own issuer is
// letting a stranger decide what `{ symbol: 'GOLD' }` meant.
const unanchored = defineDropTable({
  id: 'dragon-hoard',
  drops: [
    { asset: { symbol: 'GOLD' }, amount: 50, weight: 60 },
    { asset: { symbol: 'SWORD' }, weight: 10 },
  ],
  nothing: 30,
})
await assert.rejects(() => goldPlayer.economy.verifyDrop(goldAward, unanchored), { code: 'unanchored-table' })

const [claimed] = await goldPlayer.claims.add(goldAward)
assert.equal(claimed?.amount, 50)
const playerGold = await goldPlayer.token('GOLD', game.address)
assert.equal(await playerGold.balance(), 50)

// One entitlement per account per root. `add()` is idempotent — a bundle it has
// already claimed produces no second block and no error, which is what makes it
// safe to call on every page load. Writing the claim block directly is where the
// ledger's own refusal shows up.
assert.deepEqual(await goldPlayer.claims.add(goldAward), [])
await assert.rejects(() => goldPlayer.claims.claim(goldAward))
assert.equal(await playerGold.balance(), 50)

// Closing over somebody's unclaimed loot is taking it back, so it is refused
// until they have claimed — or forced, deliberately, by the issuer.
await assert.rejects(() => drop.close())

const swordAward = drop.awardFor(swordPlayer.address)
assert.ok(swordAward)
await swordPlayer.economy.verifyDrop(swordAward)
await swordPlayer.claims.add(swordAward)
assert.equal(await swordPlayer.items.owner(sword.id), swordPlayer.address)

const { closed, unclaimed } = await drop.close()
assert.equal(unclaimed.length, 0)
assert.equal(closed.length, drop.roots.length)

// Every unit reached a player through a claim block that player signed; the
// issuer wrote two blocks in total.
assert.equal(await gold.balanceOf(goldPlayer.address), 50)

console.log(
  JSON.stringify({
    kind: 'drop',
    roots: drop.roots.length,
    awarded: drop.awarded,
    missed: 1,
    goldQuantity: verified.quantity,
    goldChance: verified.chance,
    closed: closed.length,
  }),
)
