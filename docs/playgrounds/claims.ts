import { strict as assert } from 'node:assert'

import { Kei, KeiError } from 'kei-transaction'

async function refusedCode(work: () => Promise<unknown>): Promise<string> {
  let refused: unknown
  try {
    await work()
  } catch (error) {
    refused = error
  }
  assert.ok(refused instanceof KeiError)
  return refused.code
}

const node = await Kei.mock()
const game = await Kei.server({ seed: 'C'.repeat(64), node })
await game.faucet(20_000)

const alice = await Kei.start({ seed: 'D'.repeat(64), node })
const bob = await Kei.start({ seed: 'E'.repeat(64), node, autoClaim: false })

const gems = await game.token.issue({
  name: 'Claim Gems',
  symbol: 'CGEM',
  decimals: 0,
  maxSupply: 1_000,
  transfer: 'open',
  swap: 'off',
})

const drop = await gems.commit([
  { to: alice.address, amount: 20 },
  { to: alice.address, amount: 30 }, // one account becomes one merged leaf
  { to: bob.address, amount: 25 },
])

assert.equal(drop.count, 2)
assert.equal(drop.total, '75')
assert.equal(drop.amountFor(alice.address), '50')

const published = await node.commitInfo(drop.root)
assert.equal(published?.issuer, game.address)
assert.equal(published?.asset, gems.id)
assert.equal(published?.count, 2)
assert.equal(published?.total, '75')
assert.equal(published?.closed, false)

const aliceBundle = drop.proofFor(alice.address)
const bobBundle = drop.proofFor(bob.address)
assert.ok(aliceBundle.proof.length <= 48)
const [claim] = await alice.claims.add(aliceBundle)
assert.equal(claim?.root, drop.root)
assert.equal(claim?.amount, 50)

const aliceGems = await alice.token('CGEM', game.address)
assert.equal(await aliceGems.balance(), 50)

const duplicateRefusal = await refusedCode(() => alice.claims.claim(aliceBundle))
assert.equal(duplicateRefusal, 'already-claimed')

const proofLimitRefusal = await refusedCode(() => bob.claims.claim({
  ...bobBundle,
  proof: Array.from({ length: 49 }, () => '0'.repeat(64)),
}))
assert.equal(proofLimitRefusal, 'bad-block')

await gems.close(drop.root)
assert.equal((await node.commitInfo(drop.root))?.closed, true)

const closedRefusal = await refusedCode(() => bob.claims.claim(bobBundle))
assert.equal(closedRefusal, 'root-closed')

game.close()
alice.close()
bob.close()

console.log(JSON.stringify({
  kind: 'claims',
  published: true,
  mergedRecipients: drop.count,
  claimed: claim?.amount,
  duplicateRefusal,
  proofLimitRefusal,
  closedRefusal,
}))
