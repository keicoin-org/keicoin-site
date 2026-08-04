import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PAGES, USE_CASES } from './content.js'
import { homePage } from './home.js'
import { render } from './layout.js'
import { llmsTxt } from './machine.js'

const root = join(import.meta.dir, '..', '..')

const EXPECTED_DESTINATIONS = new Map([
  ['Add an in-game currency', '/docs/reference/tokens'],
  ['Build an inventory system', '/docs/reference/items'],
  ['Add an auction house or community market', '/docs/examples/carpet-markets/api'],
  ['Add an MMO economy', '/docs/examples/world-of-wonder/auction-house'],
  ['Hand out loot to thousands of players', '/docs/examples/world-of-wonder/loot-and-drops'],
  ['Take sub-cent payments', '/docs/reference/wallet#payments'],
])

const LEGACY_REDIRECTS = [
  ['/use-cases/in-game-currency', '/docs/reference/tokens'],
  ['/use-cases/inventory-system', '/docs/reference/items'],
  ['/use-cases/community-market', '/docs/examples/carpet-markets/api'],
  ['/use-cases/mmo-economy', '/docs/examples/world-of-wonder/auction-house'],
  ['/use-cases/loot-drops', '/docs/examples/world-of-wonder/loot-and-drops'],
  ['/use-cases/micropayments', '/docs/reference/wallet#payments'],
] as const

function docsSource(destination: string): string {
  const pathname = destination.split('#')[0]?.replace(/^\/docs\/?/, '') ?? ''
  return join(root, 'docs', `${pathname || 'index'}.md`)
}

describe('use cases resolve into the canonical docs hierarchy', () => {
  test('every card has the specific checked-in docs destination', () => {
    expect(USE_CASES).toHaveLength(EXPECTED_DESTINATIONS.size)
    expect(new Set(USE_CASES.map(({ path }) => path)).size).toBe(USE_CASES.length)

    for (const useCase of USE_CASES) {
      expect(useCase.path).toBe(EXPECTED_DESTINATIONS.get(useCase.label) ?? '')
      expect(existsSync(docsSource(useCase.path))).toBeTrue()
      if (useCase.path.endsWith('#payments')) {
        expect(readFileSync(docsSource(useCase.path), 'utf8')).toMatch(/^## Payments$/m)
      }
    }

    const worker = readFileSync(join(root, 'worker', 'index.ts'), 'utf8')
    for (const [legacy, canonical] of LEGACY_REDIRECTS) {
      expect(worker).toContain(`['${legacy}', '${canonical}']`)
    }

    const diagram = join(root, 'docs', 'public', 'img', 'docs', 'carpet-offer-lifecycle.svg')
    expect(existsSync(diagram)).toBeTrue()
    expect(readFileSync(docsSource('/docs/examples/carpet-markets/api'), 'utf8')).toContain(
      '](/img/docs/carpet-offer-lifecycle.svg)',
    )
  })

  test('the generated site publishes no parallel use-case pages or links', () => {
    expect(PAGES.some(({ path }) => path === '/use-cases' || path.startsWith('/use-cases/'))).toBeFalse()

    const rendered = [homePage(), ...PAGES.map(render), llmsTxt()].join('\n')
    expect(rendered).not.toContain('href="/use-cases')
    expect(rendered).not.toContain('https://keicoin.org/use-cases')
  })
})
