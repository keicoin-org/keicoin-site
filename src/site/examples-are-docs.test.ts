/**
 * The examples are documentation. This file is the check that the site keeps
 * saying so in every place it says anything about its own shape — the header,
 * the footer, the machine-readable pages, and the sitemap — because the one
 * that gets forgotten is the one an agent reads.
 *
 * `/examples/<name>` is a running demo on another Worker's route and must stay
 * linkable. `/examples` and `/examples/` are the editorial pages that moved, and
 * nothing here may publish them.
 */

import { describe, expect, test } from 'bun:test'

import { PAGES } from './content.js'
import { homePage } from './home.js'
import { NAV, render } from './layout.js'
import { agentsMd, llmsTxt, sitemapXml } from './machine.js'

const DEMO_MOUNTS = ['/examples/button', '/examples/carpet-markets']

describe('the header and the footer', () => {
  const page = homePage()

  test('Examples is a child of Docs, not a peer', () => {
    const nav = NAV.map(([, label]) => label)
    expect(nav.indexOf('Examples')).toBe(nav.indexOf('Docs') + 1)
    // Rendered inside one group with a separator, rather than spaced equally
    // among the top-level destinations.
    expect(page).toContain('<span class="nav-group">')
    expect(page).toMatch(/nav-group[^]*?href="\/docs"[^]*?nav-sep[^]*?href="\/docs\/examples"[^]*?<\/span>/)
  })

  test('the footer files Examples under Documentation', () => {
    const column = page.slice(page.indexOf('<h4>Documentation</h4>'))
    const documentation = column.slice(0, column.indexOf('</div>'))
    expect(documentation).toContain('<li class="foot-sub"><a href="/docs/examples">Examples</a>')
    expect(documentation).toContain('href="/docs"')
  })

  test('nothing links to the editorial pages that moved', () => {
    for (const html of [page, ...PAGES.map(render)]) {
      expect(html).not.toContain('href="/examples"')
      expect(html).not.toContain('href="/examples/"')
    }
  })

  test('the demos themselves stay linkable', () => {
    const everything = [homePage(), ...PAGES.map(render)].join('\n')
    for (const mount of DEMO_MOUNTS) expect(everything).toContain(`href="${mount}"`)
  })
})

describe('the machine-readable pages', () => {
  test('llms.txt nests the examples under the documentation entry', () => {
    const pages = llmsTxt().slice(llmsTxt().indexOf('## Pages'))
    expect(pages).toContain('- [Documentation](https://keicoin.org/docs)')
    expect(pages).toContain('  - [Examples](https://keicoin.org/docs/examples)')
    expect(pages).toContain('    - [Button](https://keicoin.org/docs/examples/button)')
  })

  test('they say which URL is a demo and which is a page about one', () => {
    expect(llmsTxt()).toContain('is a running demo')
    expect(agentsMd()).toContain('https://keicoin.org/docs/examples')
  })

  test('the install line is the version that is actually installable', () => {
    for (const file of [llmsTxt(), agentsMd()]) {
      expect(file).toContain('kei-transaction@0.7.0')
      expect(file).not.toContain('bun add kei-transaction@0.6.0')
    }
  })
})

describe('what the build publishes', () => {
  test('VitePress owns /docs; no excluded page record can stand in for it', () => {
    expect(PAGES.map((page) => page.path)).not.toContain('/docs')
  })

  test('there is no editorial /examples page in the source record', () => {
    expect(PAGES.map((page) => page.path)).not.toContain('/examples')
  })

  test('the sitemap carries the docs index and the demo mounts, not /examples', () => {
    const xml = sitemapXml(['/', ...PAGES.map((page) => page.path), '/docs', '/docs/examples', ...DEMO_MOUNTS])
    expect(xml).toContain('<loc>https://keicoin.org/docs</loc>')
    expect(xml).toContain('<loc>https://keicoin.org/docs/examples</loc>')
    for (const mount of DEMO_MOUNTS) expect(xml).toContain(`<loc>https://keicoin.org${mount}</loc>`)
    expect(xml).not.toContain('<loc>https://keicoin.org/examples</loc>')
  })
})
