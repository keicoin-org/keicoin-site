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

import { HARNESS_CRITERIA, HARNESS_CRITERIA_COUNT, PAGES, TRACKS } from './content.js'
import { homePage } from './home.js'
import { SITE, inline, render } from './layout.js'
import { agentsMd, llmsTxt } from './machine.js'

/** What a reader actually reads: no tags, no script bodies, no SVG path data. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
}

// PAGES contains only pages the site build writes. `/docs` is owned by
// docs/index.md and covered by docs-authority.test.ts against the real build.
const rendered = [homePage(), ...PAGES.map(render)]
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
    expect(status).toContain('versioned event log is authoritative')
    expect(status).toContain('eviction or a routine deploy does not reset')
    expect(status).toContain('append-only')
  })

  test('the status page says the harness does not build a complete MMO yet', () => {
    expect(status).toContain('Create Kei MMO does not build a complete MMO yet')
    expect(status).toContain('unpublished draft')
    // The criterion that decides whether the product exists.
    expect(status).toContain('Two clients seeing each other move')
  })

  /**
   * SPEC §11.3 has nine one-shot criteria, and the ninth — one presentable
   * 30-second core loop — arrived last, on 4 August 2026. A page that lists
   * eight is not merely out of date: it publishes a lower bar than the harness
   * sets itself, so an agent quoting it tells somebody a networked gray box
   * would count as the product shipping.
   */
  describe('the harness is measured against all nine of its criteria', () => {
    test('there are nine, each with a stated position today', () => {
      expect(HARNESS_CRITERIA).toHaveLength(9)
      expect(HARNESS_CRITERIA_COUNT).toBe('nine')
      for (const criterion of HARNESS_CRITERIA) {
        expect(criterion.requirement.length).toBeGreaterThan(20)
        expect(criterion.today.length).toBeGreaterThan(1)
      }
    })

    test('the status page renders every one of them', () => {
      for (const criterion of HARNESS_CRITERIA) {
        expect(status).toContain(visibleText(inline(criterion.requirement)).trim())
      }
    })

    test('the persistence and economy checkpoint closes 2–6 at construction scope while keeping the remaining product gates open', () => {
      expect(HARNESS_CRITERIA[0]?.today).toContain('Partly')
      expect(HARNESS_CRITERIA[1]?.today).toBe('Met for fresh blank 2D and 3D projects')
      expect(HARNESS_CRITERIA[2]?.today).toContain('headless client connects')
      expect(HARNESS_CRITERIA[3]?.today).toContain('each headless client observes the other')
      expect(HARNESS_CRITERIA[4]?.today).toContain('server-assigned identity, position, XP, and derived level survive clean restarts')
      expect(HARNESS_CRITERIA[4]?.today).toContain('forged authority changes neither memory nor SQLite')
      expect(HARNESS_CRITERIA[5]?.today).toContain('published `kei-transaction@0.6.0`')
      expect(HARNESS_CRITERIA[5]?.today).toContain('direct player custody')
      expect(HARNESS_CRITERIA[6]?.today).toContain('Open end to end')
      expect(HARNESS_CRITERIA[7]?.today).toContain('Advanced, not met')
      expect(HARNESS_CRITERIA[8]?.today).toBe('Open')
      expect(status).toContain('b6edae7')
      expect(status).toContain('Criteria 2, 3, 4, 5, and 6 are met')
      expect(status).toContain('Criteria 1, 7, 8, and 9 remain open')
      expect(status).toContain('bun run restart-proof')
      expect(status).toContain('bun run economy:check')
      expect(status).toContain('SHA-256 hash')
      expect(status).toContain('database schema stores no Kei economy state')
      expect(status).toContain('not account recovery')
      expect(status).toContain('not a multi-writer store or a guarantee against crash loss')
      expect(status).toContain('Scale, public hosting')
      expect(status).toContain('Issue #17')
      expect(status).toContain('First Shared Encounter')
    })

    test('both machine-readable surfaces carry the exact persistence boundary', () => {
      for (const surface of machine) {
        const prose = surface.replace(/\s+/g, ' ')
        expect(prose).toContain('b6edae7')
        expect(prose).toContain('criteria 2–6 are met only for fresh')
        expect(prose).toContain('server-assigned identity, position, XP, and derived level')
        expect(prose).toContain('SHA-256 hash of the opaque resume token')
        expect(prose).toContain('forged authority changes neither memory nor SQLite')
        expect(prose).toContain('Criteria 1, 7, 8, and 9 remain open')
        expect(prose).toContain('not account recovery')
        expect(prose).toContain('multi-writer or crash-loss guarantees')
        expect(prose).toContain('scale and public hosting')
      }
    })

    test('the two criteria that decide the product are named as such', () => {
      // Four decides whether it is an MMO; nine decides whether it is a game
      // anybody would look at. Either can fail while the other seven pass.
      expect(status).toContain('Two clients seeing each other move')
      expect(status).toContain('presentable, not merely functional')
      expect(status).toContain('Criterion 9')
    })

    test('deleting the harness has to leave the presentation proof standing', () => {
      const deletion = HARNESS_CRITERIA[7]!.requirement
      expect(deletion).toContain('2–7')
      expect(deletion).toContain('9')
    })

    test('no surface still quotes the retired count of eight', () => {
      for (const surface of [...everyPage, ...machine]) {
        expect(surface).not.toMatch(/eight (?:written )?criteria/i)
      }
    })

    test('the track that ends with them says the loop has to be presentable', () => {
      const harness = TRACKS.find((track) => track.name === 'Create Kei MMO')!
      expect(harness.done).toMatch(/present/i)
    })
  })

  test('the machine-readable surface names both drafts as drafts', () => {
    for (const file of machine) {
      expect(file).toContain('Carpet Markets')
      expect(file).toContain('Create Kei MMO')
    }
    expect(llmsTxt()).toContain('not production-ready and cannot become mainnet-ready')
    expect(llmsTxt()).toContain('replays a versioned Durable\n  Object event log across eviction')
    expect(agentsMd()).toContain('replays an append-only Durable\n  Object event log across eviction')
    expect(llmsTxt()).toContain('does **not** produce a\n  complete working MMO')
    expect(agentsMd()).toContain('Do not present **Carpet Markets** as a market a user could operate')
    expect(agentsMd()).toContain('Do not present **Create Kei MMO** as a tool that produces a complete working MMO')
  })
})

describe('the published and installed graph matches', () => {
  /**
   * The gap this site once got wrong was not `master` versus npm. It was npm
   * versus what `bun add kei-transaction` resolves, and the two stopped being
   * the same question for a few hours on 4 August 2026, when
   * `@keicoin/market@0.2.0` and `@keicoin/player-economy@0.1.0` published
   * against an umbrella that had gone out ninety minutes earlier pinning
   * `^0.1.1` and taking no dependency on player-economy. `kei-transaction@0.6.0`,
   * published the same day, is the umbrella that took both — the site's job is
   * now to say that plainly, not to keep holding the gap open after it closed.
   */
  test('the status page names both the current release and the release that closed the gap', () => {
    expect(status).toContain('Published vs installed')
    expect(status).toContain('kei-transaction@0.6.0')
    expect(status).toContain('bun add kei-transaction gets you 0.7.0')
    expect(status).toContain('@keicoin/market@0.3.0')
    expect(status).toContain('@keicoin/player-economy')
    for (const release of [
      'tokens at 0.5.2',
      'claims at 0.5.1',
      'wallet at 0.5.0',
      'economy at 0.2.1',
      'market at 0.3.0',
      'player-economy at 0.1.1',
      'core at 0.5.0',
      'work at 0.4.1',
    ]) expect(status).toContain(release)
  })

  /**
   * The failure this file exists to catch in this direction: once something
   * publishes and installs, the present-tense warning has to come off. A page
   * that still calls `kei.shop` unreachable, or the market aggregation stuck at
   * `0.1.1`, is as wrong as one that claimed them reachable too early — and
   * describing the resolved incident in the past tense (see the row above)
   * must stay legal, so this only refuses the present-tense claim.
   */
  test('nothing claims kei.shop or the market aggregation are still unreachable', () => {
    for (const surface of [...everyPage, ...machine]) {
      expect(surface).not.toMatch(/kei\.shop`? is `?undefined/i)
      expect(surface).not.toMatch(/plain (?:SDK )?install (?:still )?resolves (?:the market at )?`?0\.1\.1/i)
    }
  })

  /**
   * The same inverse check for `burn()`, in place since `@keicoin/tokens@0.5.0`
   * shipped: a page that still calls it unreachable is stale in the other
   * direction, and only one of the two directions ever gets reported.
   */
  test('nothing warns readers off burn(), reachable since 0.5.0', () => {
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
