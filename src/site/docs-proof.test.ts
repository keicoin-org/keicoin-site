import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = join(import.meta.dir, '..', '..')

const PLAYGROUNDS = [
  ['payment-reconciliation.ts', 'payment-reconciliation'],
  ['claims.ts', 'claims'],
  ['errors.ts', 'error-categories'],
] as const

const EMBEDS = new Map([
  ['docs/reference/wallet.md', '../playgrounds/payment-reconciliation.ts'],
  ['docs/reference/claims.md', '../playgrounds/claims.ts'],
  ['docs/reference/errors.md', '../playgrounds/errors.ts'],
  ['docs/guide/integration.md', '../playgrounds/payment-reconciliation.ts'],
  ['docs/guide/security.md', '../playgrounds/payment-reconciliation.ts'],
])

function source(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

describe('remaining SDK guides carry executable proof', () => {
  for (const [file, kind] of PLAYGROUNDS) {
    test(`${file} executes without a network or prompt`, () => {
      const result = spawnSync(Bun.which('bun') ?? 'bun', ['run', join('docs', 'playgrounds', file)], {
        cwd: root,
        encoding: 'utf8',
        timeout: 30_000,
        windowsHide: true,
      })

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
      const report = JSON.parse(result.stdout.trim())
      expect(report.kind).toBe(kind)

      if (kind === 'payment-reconciliation') {
        expect(report.scenarios).toEqual([
          { ordering: 'order-first', linkMatches: true, deliveries: 1 },
          { ordering: 'payment-first', linkMatches: true, deliveries: 1 },
        ])
        expect(report.memoRefusal).toBe('no-memo-yet')
      }
      if (kind === 'claims') {
        expect(report).toMatchObject({
          published: true,
          mergedRecipients: 2,
          claimed: 50,
          duplicateRefusal: 'already-claimed',
          proofLimitRefusal: 'bad-block',
          closedRefusal: 'root-closed',
        })
      }
      if (kind === 'error-categories') {
        expect(report.actions).toEqual({
          nodeUnreachableRead: 'retry',
          nodeUnreachableWrite: 'refresh',
          offerTaken: 'refresh',
          noMemoYet: 'permanent',
        })
      }
    })
  }

  test('every expanded page embeds the exact checked-in proof and names its limits', () => {
    for (const [page, include] of EMBEDS) {
      const markdown = source(page)
      expect(markdown).toContain(`<<< ${include}`)
      expect(markdown).toMatch(/^## Outcome$/m)
      expect(markdown).toMatch(/^## Authority and trust boundary$/m)
      expect(markdown).toMatch(/^## .+ state transitions$/m)
      expect(markdown).toMatch(/^## Failure cases$/m)
      expect(markdown).toMatch(/^## What `Kei\.mock\(\)` proves$/m)

      const resolved = join(dirname(join(root, page)), include)
      expect(existsSync(resolved)).toBeTrue()
    }
  })

  test('payment links resolve to the exact send/receive and recovery headings', () => {
    expect(source('docs/reference/wallet.md')).toContain(
      '(../guide/integration.md#purchase-state-transitions)',
    )
    expect(source('docs/reference/wallet.md')).toContain('(./errors.md#recovery-categories)')
    expect(source('docs/guide/integration.md')).toMatch(/^## Purchase state transitions$/m)
    expect(source('docs/reference/errors.md')).toMatch(/^## Recovery categories$/m)
  })

  test('claims links and documented bounds stay attached to their proof', () => {
    const claims = source('docs/reference/claims.md')
    expect(claims).toContain('(./errors.md#recovery-categories)')
    expect(claims).toContain('4,294,967,295 recipients')
    expect(claims).toContain('At most 48 sibling hashes')
    expect(claims).toContain('One per account per root')
  })

  test('integration and security name every authority the issue requires', () => {
    const pages = [source('docs/guide/integration.md'), source('docs/guide/security.md')]
    for (const markdown of pages) {
      for (const boundary of ['Player key', 'Issuer key', 'Balances', 'Realtime', 'index', 'Recovery']) {
        expect(markdown.toLowerCase()).toContain(boundary.toLowerCase())
      }
    }
  })

  test('the error proof is offline by construction and keeps signed writes out of retry', () => {
    const errors = source('docs/playgrounds/errors.ts')
    expect(errors).toContain("url: 'https://offline.invalid/rpc'")
    expect(errors).toContain("fetch: async () => { throw new Error('offline by construction') }")
    expect(errors).toContain("return operation === 'read' ? 'retry' : 'refresh'")
  })

  test('the security page refuses decorative screenshots and records the evidence contract', () => {
    const security = source('docs/guide/security.md')
    expect(security).not.toContain('![')
    for (const field of ['repository', 'command or URL', 'network/mock mode', 'viewport', 'scenario state', 'alt text', 'review date']) {
      expect(security.toLowerCase()).toContain(field.toLowerCase())
    }
  })
})
