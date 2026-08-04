import { strict as assert } from 'node:assert'

import { HttpNode, Kei, KeiError, randomSeed } from 'kei-transaction'

type Operation = 'read' | 'write'
type Recovery = 'retry' | 'refresh' | 'permanent'

const TRANSPORT_CODES = new Set(['node-unreachable', 'node-timeout'])
const STALE_STATE_CODES = new Set([
  'already-claimed',
  'root-closed',
  'offer-taken',
  'offer-cancelled',
  'offer-changed',
])

function recoveryFor(error: KeiError, operation: Operation): Recovery {
  if (TRANSPORT_CODES.has(error.code)) {
    // A read is safe to repeat. A signed write may have landed before the reply
    // was lost, so it must refresh/reconcile state before any resubmission.
    return operation === 'read' ? 'retry' : 'refresh'
  }
  if (STALE_STATE_CODES.has(error.code)) return 'refresh'
  return 'permanent'
}

async function refused(work: () => Promise<unknown>): Promise<KeiError> {
  let caught: unknown
  try {
    await work()
  } catch (error) {
    caught = error
  }
  assert.ok(caught instanceof KeiError)
  return caught
}

const node = await Kei.mock()
const game = await Kei.server({ seed: 'C'.repeat(64), node })
await game.faucet(20_000)

const seller = await Kei.start({ node, seed: randomSeed(), autoCancelExpired: false })
const buyer = await Kei.start({ node, seed: randomSeed(), autoCancelExpired: false })
await Promise.all([game.send(seller.address, 100), game.send(buyer.address, 100)])
await Promise.all([seller.sync(), buyer.sync()])

const item = await game.items.create({ name: 'Error Proof Sword' })
await game.items.mint(item.id, seller.address)
await seller.sync()

const offer = await seller.market.sell({ asset: item, price: 5 })
await buyer.market.accept(offer)
const staleOffer = await refused(() => buyer.market.accept(offer))
assert.equal(staleOffer.code, 'offer-taken')
assert.equal(recoveryFor(staleOffer, 'write'), 'refresh')

const noMemo = await refused(() => buyer.pay({
  to: game.address,
  amount: 0.05,
  memo: 'order-123',
}))
assert.equal(noMemo.code, 'no-memo-yet')
assert.equal(recoveryFor(noMemo, 'write'), 'permanent')

const offline = new HttpNode({
  url: 'https://offline.invalid/rpc',
  // A stub that only ever throws still has to satisfy `typeof fetch`, which
  // carries `preconnect` on this runtime. The cast is the stub saying so.
  fetch: (async () => { throw new Error('offline by construction') }) as unknown as typeof globalThis.fetch,
})
const unavailable = await refused(() => offline.accountInfo(buyer.address))
assert.equal(unavailable.code, 'node-unreachable')
assert.equal(recoveryFor(unavailable, 'read'), 'retry')
assert.equal(recoveryFor(unavailable, 'write'), 'refresh')

game.close()
seller.close()
buyer.close()

console.log(JSON.stringify({
  kind: 'error-categories',
  actions: {
    nodeUnreachableRead: recoveryFor(unavailable, 'read'),
    nodeUnreachableWrite: recoveryFor(unavailable, 'write'),
    offerTaken: recoveryFor(staleOffer, 'write'),
    noMemoYet: recoveryFor(noMemo, 'write'),
  },
  codes: [unavailable.code, staleOffer.code, noMemo.code],
}))
