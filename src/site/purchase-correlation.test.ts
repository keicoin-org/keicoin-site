import { expect, test } from 'bun:test'
import { Kei, MockNode, type PaymentEvent } from 'kei-transaction'

test('a receive links to the pay send hash and payment-before-order reconciles once', async () => {
  const node = await MockNode.create()
  const game = await Kei.server({ seed: 'C'.repeat(64), node })
  const player = await Kei.start({ seed: 'D'.repeat(64), node })
  await player.faucet(1)

  // Maps stand in for durable tables. Production recordPayment/recordOrder and
  // claimFulfillment must be atomic and carry a unique constraint on sendHash.
  const payments = new Map<string, PaymentEvent>()
  const orders = new Set<string>()
  const fulfilled = new Set<string>()
  let deliveries = 0

  const reconcile = (sendHash: string): void => {
    if (!payments.has(sendHash) || !orders.has(sendHash) || fulfilled.has(sendHash)) return
    fulfilled.add(sendHash)
    deliveries++
  }

  let observedReceiveHash = ''
  let observedSendHash = ''
  const observed = new Promise<void>((resolve, reject) => {
    game.onPayment(async (payment) => {
      try {
        observedReceiveHash = payment.hash
        const receive = await game.client.node.blockInfo(payment.hash)
        if (!receive || receive.type !== 'state' || !['open', 'receive'].includes(receive.subtype)) {
          throw new Error('Payment event did not resolve to a receive block.')
        }
        observedSendHash = receive.link
        payments.set(receive.link, payment)
        reconcile(receive.link)
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  })

  const receipt = await player.pay({ to: game.address, amount: 0.05 })
  await observed

  expect(observedReceiveHash).not.toBe(receipt.hash)
  expect(observedSendHash).toBe(receipt.hash)
  expect(deliveries).toBe(0)

  // The order arrives second; either side invokes the same reconciliation.
  orders.add(receipt.hash)
  reconcile(receipt.hash)
  reconcile(receipt.hash)
  expect(deliveries).toBe(1)

  game.close()
  player.close()
})
