import { strict as assert } from 'node:assert'

import { Kei, randomSeed } from 'kei-transaction'

// An in-process ledger makes this example deterministic and safe to run.
// Replace `node` with a node URL only when you deliberately want network I/O.
const node = await Kei.mock()
const game = await Kei.server({ seed: 'C'.repeat(64), node })
await game.faucet(20_000)

const player = await Kei.start({ node, seed: randomSeed() })
const friend = await Kei.start({ node, seed: randomSeed() })

const gems = await game.token.issue({
  name: 'Gems',
  symbol: 'GEM',
  decimals: 0,
  maxSupply: 1_000,
  transfer: 'open',
  swap: 'off',
})

await gems.mint(player.address, 500)
await player.sync() // Minted assets are receivable until the wallet collects them.

const playerGems = await player.token('GEM', game.address)
assert.equal(await playerGems.balance(), 500)

await playerGems.transfer(friend.address, 125)
await friend.sync()

const friendGems = await friend.token('GEM', game.address)
assert.equal(await playerGems.balance(), 375)
assert.equal(await friendGems.balance(), 125)

console.log(JSON.stringify({ kind: 'currency', player: 375, friend: 125, total: 500 }))
