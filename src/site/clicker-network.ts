// @keicoin/core's ZERO_ADDRESS: a valid null account with no spendable key.
// Testnet-only Kei sent here is deliberately unrecoverable.
export const CLICK_SINK_ADDRESS = 'kei_1111111111111111111111111111111111111111111111111111hifc8npp'
export const CLICK_SEND_AMOUNT = '0.000001'
export const CLICK_FUND_AMOUNT = '0.01'

/**
 * Same-origin path the homepage clicker points `Kei.start({ workServer })` at.
 * `worker/index.ts` answers it; both sides import this file so the route can
 * never drift out of sync between the client and the Worker that serves it.
 */
export const CLICK_WORK_PATH = '/kei/work'

/**
 * The node the clicker's work server reads proof-of-work thresholds from.
 * `Kei.start()` (no `node` option, from the client) defaults to this same
 * public testnet URL — kept explicit here rather than left implicit in two
 * places, so the client and its work server cannot silently point at
 * different chains.
 */
export const CLICK_NODE_URL = 'https://testnet.keicoin.org/rpc'
export const CLICK_NETWORK = 'testnet'
