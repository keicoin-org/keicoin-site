import { strict as assert } from 'node:assert'

import { Kei, randomSeed } from 'kei-transaction'

const node = await Kei.mock()
const game = await Kei.server({ seed: 'C'.repeat(64), node })
await game.faucet(20_000)

const player = await Kei.start({ node, seed: randomSeed() })
const friend = await Kei.start({ node, seed: randomSeed() })

const sword = await game.items.create({
  name: 'Sword of Testing',
  description: 'A unique item used by the documentation playground.',
  transfer: 'open',
})

await game.items.mint(sword.id, player.address)
await player.sync()
assert.equal(await player.items.owner(sword.id), player.address)

await player.items.transfer(sword.id, friend.address)
await friend.sync()
assert.equal(await friend.items.owner(sword.id), friend.address)

console.log(JSON.stringify({ kind: 'item', item: sword.name, ownerChanged: true }))
