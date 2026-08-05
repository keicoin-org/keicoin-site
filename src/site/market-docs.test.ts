/**
 * The market page against the market package that is actually installed.
 *
 * This page has already published a surface that did not exist. `history()`,
 * `ohlc()`, `ticker()` and `chart()` are compatibility wrappers on
 * `kei-transaction`'s master branch; publication is frozen behind
 * kei-transaction#107, so an integrator installing the umbrella gets
 * `@keicoin/market@0.4.0`, which has none of them. A reader following the page
 * got `TypeError: not a function`, which is the exact failure the site exists to
 * make impossible.
 *
 * So the page is held to the installed `MarketApi` rather than to prose review:
 * every signature it prints has to be a method the package declares, every
 * method the package declares has to appear on the page, and the four
 * unpublished names may appear only inside the warning that says they are
 * unpublished. `docs/playgrounds/market-chart.ts` asserts the same absence at
 * runtime, so the day the wrappers ship, both fail and the page is rewritten
 * rather than quietly becoming wrong in the other direction.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')
const read = (...path: string[]): string => readFileSync(join(root, ...path), 'utf8').replace(/\r\n/g, '\n')

const PAGE = 'docs/examples/carpet-markets/api.md'
const page = read(...PAGE.split('/'))

/** Named on master, in no published package. */
const UNPUBLISHED = ['history', 'ohlc', 'ticker', 'chart'] as const

const installed = JSON.parse(
  read('node_modules', '@keicoin', 'market', 'package.json'),
) as { version: string }

/** Every method `MarketApi` declares in the installed package. */
function declaredMethods(): Set<string> {
  const types = read('node_modules', '@keicoin', 'market', 'dist', 'market.d.ts')
  const body = types.slice(types.indexOf('export interface MarketApi {'))
  return new Set([...body.matchAll(/^ {4}(\w+)\(/gm)].map((match) => match[1] as string))
}

/** Every signature the page prints, from the fenced blocks that print them. */
function documentedMethods(): Set<string> {
  const fenced = [...page.matchAll(/```ts\n([\s\S]*?)```/g)].map((match) => match[1] as string)
  const found = new Set<string>()
  for (const block of fenced) {
    for (const line of block.split('\n')) {
      const match = /^(\w+)\(.*\): \S/.exec(line)
      if (match) found.add(match[1] as string)
    }
  }
  return found
}

describe('the market page documents the market package that is installed', () => {
  test('it names the version it was written against, and that is the installed one', () => {
    expect(page).toContain(`\`@keicoin/market@${installed.version}\``)
  })

  test('every signature on the page is a method the package declares', () => {
    const declared = declaredMethods()
    expect(declared.size).toBeGreaterThan(10)

    for (const method of documentedMethods()) {
      expect(declared, `the page prints ${method}(), which @keicoin/market does not declare`).toContain(
        method,
      )
    }
  })

  test('every method the package declares appears on the page', () => {
    const documented = documentedMethods()
    for (const method of declaredMethods()) {
      expect(documented, `@keicoin/market declares ${method}(), which the page never shows`).toContain(
        method,
      )
    }
  })

  test('the unpublished wrappers are absent from the package and marked on the page', () => {
    const declared = declaredMethods()
    for (const name of UNPUBLISHED) {
      expect(declared, `${name}() is published now — rewrite the page rather than the test`).not.toContain(
        name,
      )
    }

    // Named once, in the warning, with the blocker a reader can open.
    expect(page).toContain('`history`, `ohlc`, `ticker` and `chart` are not published')
    expect(page).toContain('https://github.com/keicoin-org/kei-transaction/issues/107')
    expect(page).toContain('is `TypeError: not a function`')
  })

  test('the page states what coverage does and does not answer', () => {
    const prose = page.replace(/\s+/g, ' ')

    expect(prose).toContain('Coverage is about the accounts you named, not about the market')
    expect(prose).toContain('There is no global order book and no indexer')
    expect(prose).toContain('`coverage.complete: false` means some chain did not answer')
    expect(prose).toContain('`medianPrice()` is a scalar and cannot carry any of this')
    expect(prose).toContain('Ordering is advisory')
    expect(prose).toContain('Verify a trade against the block, not against a chart')
  })

  test('the chart claims are attached to a file the reader can run', () => {
    expect(page).toContain('<<< ../../playgrounds/market-chart.ts')
    expect(page).toContain('bun run docs/playgrounds/market-chart.ts')

    // The proof asserts the absence, so the docs claim and the runtime claim
    // cannot drift apart.
    const proof = read('docs', 'playgrounds', 'market-chart.ts')
    expect(proof).toContain("const unpublished = ['history', 'ohlc', 'ticker', 'chart'].filter(")
    expect(proof).toContain('assert.deepEqual(unpublished, [])')
    expect(proof).toContain("assert.equal(series.ordering.by, 'advisory-time')")
    expect(proof).toContain('assert.equal(narrow.points.length, 2)')
  })

  test('no page anywhere promises a pool, an AMM, or a global book', () => {
    expect(page).not.toMatch(/\bAMM\b/)
    expect(page.replace(/\s+/g, ' ')).toContain('Matching, curves, automated pricing | Not part of this API.')
  })
})
