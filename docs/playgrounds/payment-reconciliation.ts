import { strict as assert } from 'node:assert'

import { Kei, KeiError, type PaymentEvent } from 'kei-transaction'

type Ordering = 'order-first' | 'payment-first'

interface Order {
  sendHash: string
  from: string
  amount: number
}

interface ConfirmedPayment {
  sendHash: string
  receiveHash: string
  from: string
  amount: number
}

async function scenario(ordering: Ordering) {
  const node = await Kei.mock()
  const game = await Kei.server({ seed: 'C'.repeat(64), node })
  const player = await Kei.start({ seed: 'D'.repeat(64), node })
  await player.faucet(1)

  // These maps stand in for durable tables. In production, inserting the
  // fulfillment row and granting the purchase belong in one transaction with a
  // unique constraint on sendHash.
  const orders = new Map<string, Order>()
  const payments = new Map<string, ConfirmedPayment>()
  const fulfilled = new Set<string>()
  let deliveries = 0

  const reconcile = (sendHash: string) => {
    const order = orders.get(sendHash)
    const payment = payments.get(sendHash)
    if (!order || !payment || fulfilled.has(sendHash)) return
    assert.equal(payment.from, order.from)
    assert.equal(payment.amount, order.amount)
    fulfilled.add(sendHash)
    deliveries += 1
  }

  const recordOrder = (order: Order) => {
    orders.set(order.sendHash, order)
    reconcile(order.sendHash)
  }

  let releasePayment!: () => void
  const paymentGate = new Promise<void>((resolve) => { releasePayment = resolve })
  let observed!: (payment: PaymentEvent) => void
  const observedPayment = new Promise<PaymentEvent>((resolve) => { observed = resolve })

  const stop = game.onPayment(async (event) => {
    if (ordering === 'order-first') await paymentGate
    const receive = await game.client.node.blockInfo(event.hash)
    assert.ok(receive && receive.type === 'state')
    assert.ok(receive.subtype === 'open' || receive.subtype === 'receive')

    const confirmed: ConfirmedPayment = {
      sendHash: receive.link,
      receiveHash: event.hash,
      from: event.from,
      amount: event.amount,
    }
    payments.set(confirmed.sendHash, confirmed)
    reconcile(confirmed.sendHash)
    observed(event)
  })

  const receipt = await player.pay({ to: game.address, amount: 0.05 })
  if (ordering === 'order-first') {
    recordOrder({ sendHash: receipt.hash, from: player.address, amount: 0.05 })
    releasePayment()
  }

  const event = await observedPayment
  const receive = await game.client.node.blockInfo(event.hash)
  assert.ok(receive && receive.type === 'state')
  assert.notEqual(event.hash, receipt.hash)
  assert.equal(receive.link, receipt.hash)

  if (ordering === 'payment-first') {
    assert.equal(deliveries, 0)
    recordOrder({ sendHash: receipt.hash, from: player.address, amount: 0.05 })
  }

  // Any retry, replayed webhook, or repeated worker pass reaches the same path.
  reconcile(receipt.hash)
  reconcile(receipt.hash)
  assert.equal(deliveries, 1)
  assert.equal(fulfilled.size, 1)

  stop()
  game.close()
  player.close()
  return { ordering, linkMatches: true, deliveries }
}

const orderFirst = await scenario('order-first')
const paymentFirst = await scenario('payment-first')

const memoNode = await Kei.mock()
const memoGame = await Kei.server({ seed: 'E'.repeat(64), node: memoNode })
const memoPlayer = await Kei.start({ seed: 'F'.repeat(64), node: memoNode })
await memoPlayer.faucet(1)

let memoRefusal = ''
try {
  await memoPlayer.pay({ to: memoGame.address, amount: 0.05, memo: 'order-123' })
} catch (error) {
  assert.ok(error instanceof KeiError)
  memoRefusal = error.code
}
assert.equal(memoRefusal, 'no-memo-yet')

memoGame.close()
memoPlayer.close()

console.log(JSON.stringify({
  kind: 'payment-reconciliation',
  scenarios: [orderFirst, paymentFirst],
  memoRefusal,
}))
