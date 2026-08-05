/**
 * The site publishes one claim it could not previously check: that the codes in
 * the error and claims tables are the codes a reader will see. They were not.
 * `already-claimed`, `root-closed`, `bad-proof` and `not-in-commit` are raised
 * by the mock ledger in `@keicoin/core`; a write the public node refuses arrives
 * as `node-error` with the reason in the message. Measured 4 August 2026 against
 * https://testnet.keicoin.org/rpc on kei-transaction@0.8.0.
 *
 * These tests are offline. They assert that the correction stays on the pages
 * and that the mock-only codes are still mock-only in the installed package, so
 * a release that makes the node send granular codes fails here and the pages get
 * rewritten rather than quietly becoming wrong in the other direction.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')
const read = (...path: string[]): string => readFileSync(join(root, ...path), 'utf8').replace(/\r\n/g, '\n')

/** Refusals the mock ledger raises and the public node does not send. */
const MOCK_ONLY = ['already-claimed', 'root-closed', 'bad-proof'] as const

describe('the public testnet proof', () => {
  test('the live playground is the only one that names the public node URL', () => {
    const live = read('docs', 'playgrounds', 'testnet-live.ts')
    expect(live).toContain("const NODE = 'https://testnet.keicoin.org/rpc'")

    // It asserts what the node returns, not what the mock returns.
    expect(live).toContain("assert.equal(duplicate.code, 'node-error')")
    expect(live).toContain("assert.equal(closed.code, 'node-error')")
    expect(live).toContain("assert.equal(taken.code, 'offer-taken')")
    expect(live).toContain("assert.equal(memo.code, 'no-memo-yet')")

    // The two claims the quickstart makes about swaps, in the file.
    expect(live).toContain('assert.equal(await game.items.owner(sword.id), null)')
    expect(live).toContain('assert.equal(await buyer.items.owner(sword.id), buyer.address)')
  })

  test('the page embeds the exact executed file and its captured output', () => {
    const page = read('docs', 'reference', 'testnet.md')

    expect(page).toContain('<<< ../playgrounds/testnet-live.ts')
    expect(page).toContain('bun run docs/playgrounds/testnet-live.ts')
    expect(page).toContain('"kind":"testnet-live"')
    expect(page).toContain('"duplicateClaim":"node-error"')

    // The evidence contract: what it ran against, and when.
    expect(page).toContain('Banano V25.1')
    expect(page).toContain('4 August 2026')
    expect(page).toContain('kei-transaction@0.8.0')

    // And the limits, at the same volume as the capability.
    expect(page).toContain('There is no mainnet')
    expect(page).toContain('not distributed consensus')
    expect(page).toContain('no global order book and no indexer')
  })

  test('no page presents a mock-only code as one the node sends', () => {
    const claims = read('docs', 'reference', 'claims.md')
    const errors = read('docs', 'reference', 'errors.md')

    // claims.md still documents them — with the node's answer beside each.
    expect(claims).toContain('These codes are what `Kei.mock()` returns, not what the node returns')
    expect(claims).toContain('arrives as `node-error`')
    expect(claims).toContain('This account has already claimed from that root')

    // The old wording promised the granular code as the outcome of a state
    // transition. It cannot be restored without failing here.
    expect(claims).not.toContain('is `already-claimed`.')
    expect(claims).not.toContain('a direct claim is `root-closed`.')

    // errors.md carries the origin rule, and no longer files node refusals
    // under a granular code.
    expect(errors).toContain('## Where the code comes from decides whether it is stable')
    expect(errors).toContain('and every `node-error`')
    expect(errors).not.toContain('`offer-changed`, `already-claimed`, `root-closed`')
  })

  test('the guides that branch on codes point at the origin rule', () => {
    const anchor = 'errors.md#where-the-code-comes-from-decides-whether-it-is-stable'
    expect(read('docs', 'guide', 'integration.md')).toContain(anchor)
    expect(read('docs', 'guide', 'security.md')).toContain(anchor)
    expect(read('docs', 'reference', 'claims.md')).toContain(anchor)
  })

  test('the mock-only codes are still mock-only in the installed package', () => {
    // If a future @keicoin/core throws these outside the mock ledger, or the
    // node starts sending them, this fails and the tables above are the thing
    // to rewrite.
    const ledger = readFileSync(
      join(root, 'node_modules', '@keicoin', 'core', 'dist', 'mock', 'ledger.js'),
      'utf8',
    )
    for (const code of MOCK_ONLY) expect(ledger).toContain(`fail('${code}'`)

    const client = readFileSync(
      join(root, 'node_modules', '@keicoin', 'core', 'dist', 'client.js'),
      'utf8',
    )
    for (const code of MOCK_ONLY) expect(client).not.toContain(`fail('${code}'`)

    // The counter-examples, both client-side, which is why they are the same
    // code live and under the mock.
    expect(client).toContain("fail('no-memo-yet'")
    expect(
      readFileSync(join(root, 'node_modules', '@keicoin', 'claims', 'dist', 'tree.js'), 'utf8'),
    ).toContain("fail('not-in-commit'")
  })

  test('the offline playground set stays offline — the live one is declared out of it', () => {
    expect(read('src', 'site', 'docs-playgrounds.test.ts')).not.toContain('testnet-live')

    // `docs-proof.test.ts` derives the offline set from the directory, so the
    // live one has to be named there — as the exclusion, and only as that. If a
    // later edit runs it alongside the rest, the clean-clone-on-a-plane claim
    // stops being true and this is what catches it.
    const offline = read('src', 'site', 'docs-proof.test.ts')
    expect(offline).toContain("const NETWORK_PLAYGROUNDS = new Set(['testnet-live.ts'])")
    expect(offline).toContain(
      'playgroundFiles().filter((name) => !NETWORK_PLAYGROUNDS.has(name))',
    )
    expect(offline.match(/testnet-live/g)).toHaveLength(1)

    // And the live page says so itself, rather than leaving a reader to find out
    // by running it on a plane.
    expect(read('docs', 'reference', 'testnet.md')).toContain(
      '**This playground needs the network.**',
    )
  })
})
