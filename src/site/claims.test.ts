/**
 * The honesty guards.
 *
 * SPEC §12: an agent cannot detect overstatement and cannot ask a follow-up
 * question, so a claim a human would read as enthusiasm becomes a
 * specification and then a broken integration in somebody's game. These tests
 * hold down the three overstatements this site has actually been caught
 * making, plus the one stale vocabulary that makes it unquotable.
 *
 * They are string checks on rendered output rather than on source, because the
 * thing that has to be true is what a reader receives.
 */

import { describe, expect, test } from 'bun:test'

import { PAGES, TRACKS } from './content.js'
import { homePage } from './home.js'
import { SITE, render } from './layout.js'
import { agentsMd, llmsTxt } from './machine.js'

/** What a reader actually reads: no tags, no script bodies, no SVG path data. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
}

const rendered = [homePage(), ...PAGES.filter((page) => page.path !== '/docs').map(render)]
const everyPage = rendered.map(visibleText)
const machine = [llmsTxt(), agentsMd()]
const status = visibleText(render(PAGES.find((page) => page.path === '/status')!))

describe('milestone numbers are retired', () => {
  /**
   * The M0–M10 ladder was retired in SPEC §13 on 3 August 2026 and replaced by
   * four concurrent tracks. A page still saying "M5 swaps" describes a plan
   * that no longer exists, and an agent quoting it emits a label nothing else
   * on the internet can resolve. The range itself may be named — that is how
   * you say the ladder is gone — but nothing may carry a bare label.
   */
  const BARE_LABEL = /\bM(?:10|[0-9])\b/

  test('no rendered page uses one', () => {
    for (const text of everyPage) {
      expect(text.replace(/M0–M10/g, '')).not.toMatch(BARE_LABEL)
    }
  })

  test('neither machine-readable file uses one', () => {
    for (const file of machine) {
      expect(file.replace(/M0–M10/g, '')).not.toMatch(BARE_LABEL)
    }
  })

  test('the site-wide status line uses one', () => {
    expect(`${SITE.milestone} ${SITE.status}`).not.toMatch(BARE_LABEL)
  })
})

describe('the four tracks are stated once and rendered everywhere', () => {
  test('there are four, each with a checkable finish condition', () => {
    expect(TRACKS).toHaveLength(4)
    for (const track of TRACKS) {
      expect(track.done.length).toBeGreaterThan(40)
      // A condition, not a schedule. A track with a date on it starts lying on
      // that date.
      expect(track.done).not.toMatch(/\b20\d\d\b|\bQ[1-4]\b/)
    }
  })

  test('the landing page, the status page and llms.txt all name them', () => {
    for (const track of TRACKS) {
      expect(visibleText(homePage())).toContain(track.name)
      expect(status).toContain(track.name)
      expect(llmsTxt()).toContain(track.name)
    }
  })

  test('mainnet is not one of them, and is not a build task', () => {
    for (const track of TRACKS) expect(track.name.toLowerCase()).not.toContain('mainnet')
    expect(status).toContain('not a build task')
    expect(agentsMd()).toContain('Mainnet is not a build task')
  })
})

describe('nothing implies the demos or the harness are finished', () => {
  test('every page carries the no-mainnet, no-value status line', () => {
    for (const text of everyPage) {
      expect(text).toContain('no mainnet')
      expect(text).toContain('nothing here holds value')
    }
  })

  test('the status page says what Carpet Markets actually is', () => {
    expect(status).toContain('mock-chain demo')
    expect(status).toContain('materially weaker')
    expect(status).toContain('cannot become mainnet-ready')
  })

  test('the status page says the harness does not build an MMO yet', () => {
    expect(status).toContain('Create Kei MMO does not build an MMO yet')
    expect(status).toContain('unpublished draft')
    // The criterion that decides whether the product exists.
    expect(status).toContain('Two clients seeing each other move')
  })

  test('the machine-readable surface names both drafts as drafts', () => {
    for (const file of machine) {
      expect(file).toContain('Carpet Markets')
      expect(file).toContain('Create Kei MMO')
    }
    expect(llmsTxt()).toContain('not production-ready and cannot become mainnet-ready')
    expect(llmsTxt()).toContain('does **not** produce a\n  working MMO')
    expect(agentsMd()).toContain('Do not present **Carpet Markets** as a market a user could operate')
    expect(agentsMd()).toContain('Do not present **Create Kei MMO** as a tool that produces a working game')
  })
})

describe('installable and merged are kept apart', () => {
  /**
   * The gap between `master` and npm is where this site's wrong claims come
   * from: `burn()` was listed as shipping in 0.4.0 for as long as it existed on
   * a branch. A reader installing the package and calling it gets a
   * `TypeError`, which reads as a broken SDK rather than as a wrong page.
   */
  test('the status page separates the two, by name', () => {
    expect(status).toContain('Installable vs merged')
    expect(status).toContain('not published')
    expect(status).toContain('@keicoin/economy')
  })

  /**
   * Every mention of an unpublished call, wherever it appears, has to sit
   * within sight of the reason it will not work — before it or after it, since
   * a table row states the caveat first and a code block states it second.
   *
   * The list is the point of maintenance, and it moves with the registry rather
   * than with `master`. `burn(` was on it until `@keicoin/tokens@0.5.0` shipped
   * on 4 August 2026; leaving it here after that would have made the site warn
   * readers away from a call they can make. What is on it now is `kei.shop`,
   * from the unpublished `@keicoin/player-economy`, and the market aggregation
   * that is `@keicoin/market@0.2.0` while npm serves `0.1.1`.
   */
  test('nothing offers an unpublished call without saying so nearby', () => {
    const disclaimer = /not in the installable|NOT in the installable|not published|unpublished|does not depend on it/i
    const unpublished = /kei\.shop|\.book\(|\.series\(|\.candles\(/g
    for (const surface of [...everyPage, ...machine]) {
      for (const match of surface.matchAll(unpublished)) {
        const from = Math.max(0, match.index - 400)
        expect(surface.slice(from, match.index + 400)).toMatch(disclaimer)
      }
    }
  })

  /**
   * The inverse, and the failure this file exists to catch in the other
   * direction: once something publishes, the warning has to come off. A page
   * that still calls `burn()` unpublished is as wrong as one that called it
   * shipped too early, and only one of the two ever gets reported.
   */
  test('nothing warns readers off a call that has since published', () => {
    for (const surface of [...everyPage, ...machine]) {
      for (const match of surface.matchAll(/burn\(/g)) {
        const window = surface.slice(Math.max(0, match.index - 300), match.index + 300)
        expect(window).not.toMatch(/not in the installable|NOT in the installable/i)
      }
    }
  })
})

describe('claims come with something to run', () => {
  test('the status page publishes the commands behind its behavioural claims', () => {
    for (const command of ['bun run test:m3-live', 'bun run check', '--plan-only']) {
      expect(status).toContain(command)
    }
  })

  test('llms.txt sends an agent to a command rather than to itself', () => {
    expect(llmsTxt()).toContain('Verify any of this yourself')
    expect(llmsTxt()).toContain('bun run test:m3-live')
  })
})
