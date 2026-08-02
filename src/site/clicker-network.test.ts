import { expect, test } from 'bun:test'
import { Kei } from 'kei-transaction'

import { CLICK_SEND_AMOUNT, CLICK_SINK_ADDRESS } from './clicker-network.js'

test('the player client accepts a signed click send to the null account', async () => {
  const node = await Kei.mock()
  const player = await Kei.start({ node })
  await player.faucet('0.01')

  const before = await player.balance()
  const receipt = await player.send(CLICK_SINK_ADDRESS, CLICK_SEND_AMOUNT)

  expect(receipt.to).toBe(CLICK_SINK_ADDRESS)
  expect(receipt.amount).toBe(Number(CLICK_SEND_AMOUNT))
  expect(receipt.hash).toMatch(/^[A-F0-9]{64}$/)
  expect(await player.balance()).toBeLessThan(before)
})
