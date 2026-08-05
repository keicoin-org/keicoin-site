import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = join(import.meta.dir, '..', '..')

const PLAYGROUNDS = [
  ['payment-reconciliation.ts', 'payment-reconciliation'],
  ['claims.ts', 'claims'],
  ['errors.ts', 'error-categories'],
] as const

/**
 * The one playground that publishes blocks to the public node, and therefore
 * the one that a clean clone cannot run on a plane. Everything else in
 * `docs/playgrounds/` has to run with no network, no secret and no prompt — so
 * the set is derived from the directory rather than listed, and a new file that
 * nobody classified fails here instead of quietly going unproven.
 */
const NETWORK_PLAYGROUNDS = new Set(['testnet-live.ts'])

const playgroundFiles = (): string[] =>
  readdirSync(join(root, 'docs', 'playgrounds'))
    .filter((name) => name.endsWith('.ts'))
    .sort()

const offlinePlaygrounds = (): string[] =>
  playgroundFiles().filter((name) => !NETWORK_PLAYGROUNDS.has(name))

/** Markdown under `docs/`, minus the VitePress internals and the partials. */
function docPages(dir = join(root, 'docs')): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.vitepress' || entry.name === 'evidence' || entry.name === 'public') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...docPages(path))
    else if (entry.name.endsWith('.md')) found.push(relative(root, path).replace(/\\/g, '/'))
  }
  return found.sort()
}

const playgroundDir = join(root, 'docs', 'playgrounds')

/**
 * The playgrounds a page pulls in with `<<<`, resolved rather than pattern
 * matched: pages sit at two different depths, so `../playgrounds/market.ts` and
 * `../../playgrounds/market.ts` are the same include.
 */
function embedsOf(page: string): string[] {
  const dir = dirname(join(root, page))
  const found: string[] = []
  for (const match of source(page).matchAll(/^<<< (\S+)/gm)) {
    const target = (match[1] as string).split(/[{#]/)[0] as string
    const resolved = resolve(dir, target)
    if (dirname(resolved) === playgroundDir) {
      expect(existsSync(resolved), `${page} embeds ${target}, which does not exist`).toBeTrue()
      found.push(basename(resolved))
    }
  }
  return found
}

/**
 * Each offline playground is executed once per suite run and the output is
 * reused, because the same stdout answers three different questions: that the
 * file runs, that its report still has the shape the page describes, and that
 * the line printed beside the command on the page is the line it really prints.
 */
const executed = new Map<string, string>()

function runPlayground(file: string): string {
  const cached = executed.get(file)
  if (cached !== undefined) return cached

  const result = spawnSync(Bun.which('bun') ?? 'bun', ['run', join('docs', 'playgrounds', file)], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
  })

  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
  const stdout = result.stdout.trim()
  executed.set(file, stdout)
  return stdout
}

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
      const report = JSON.parse(runPlayground(file))
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
    expect(errors).toContain("throw new Error('offline by construction')")
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

/**
 * The registry. The suites above assert what three named playgrounds report;
 * this asserts that the set itself is closed — every file in the directory is
 * classified, executed, embedded on a page, and printing the line the page says
 * it prints. Adding a tenth playground and forgetting to prove it fails here.
 */
describe('the playground set is closed', () => {
  test('every playground is either offline or declared to need the network', () => {
    const files = playgroundFiles()
    expect(files.length).toBeGreaterThan(0)

    for (const declared of NETWORK_PLAYGROUNDS) {
      expect(files, `${declared} is declared to need the network but does not exist`).toContain(declared)
    }

    // The live one is named on its own page, and named as needing the network.
    expect(source('docs/reference/testnet.md')).toContain('**This playground needs the network.**')
  })

  test('every offline playground runs from the repository root and prints one JSON report', () => {
    for (const file of offlinePlaygrounds()) {
      const stdout = runPlayground(file)
      const report = JSON.parse(stdout)
      expect(typeof report.kind, `${file} printed no kind`).toBe('string')
      expect(stdout.includes('\n'), `${file} printed more than one line`).toBeFalse()
    }
  }, 180_000)

  test('every playground is embedded, verbatim, on at least one page', () => {
    const pages = docPages()
    for (const file of playgroundFiles()) {
      const embedding = pages.filter((page) => embedsOf(page).includes(file))
      expect(embedding.length, `${file} is not embedded on any page`).toBeGreaterThan(0)
    }
  })

  test('the output printed beside a command is the output that command produces', () => {
    for (const page of docPages()) {
      const samples = source(page).match(/^# (\{.*\})$/gm) ?? []
      if (samples.length === 0) continue

      const offline = embedsOf(page).filter((file) => !NETWORK_PLAYGROUNDS.has(file))
      expect(
        offline.length,
        `${page} prints a sample report and embeds no offline playground that could produce it`,
      ).toBeGreaterThan(0)

      const printed = offline.map(runPlayground)
      for (const sample of samples) {
        expect(printed, `${page} shows a report none of ${offline.join(', ')} prints`).toContain(
          sample.slice(2),
        )
      }
    }
  }, 180_000)

  test('every offline playground has its real output printed beside a command', () => {
    const printed = docPages().flatMap((page) => source(page).match(/^# (\{.*\})$/gm) ?? [])
    for (const file of offlinePlaygrounds()) {
      expect(printed, `no page prints what ${file} outputs`).toContain(`# ${runPlayground(file)}`)
    }
  }, 180_000)
})

/**
 * The screenshot evidence contract, enforced rather than described.
 *
 * `docs/guide/security.md` states the fields a runtime capture has to record.
 * A capture that cannot record them is not evidence, and the failure mode this
 * catches is the quiet one: an image sitting above a proof, borrowing its
 * authority, with nothing on the page saying which of the two the reader is
 * looking at.
 */
describe('every capture carries its provenance', () => {
  const IMAGE = /!\[([^\]]*)\]\((\/img\/docs\/[^)\s]+)\)/g

  /** The rows a provenance record has to have, from the contract in security.md. */
  const CONTRACT_ROWS = [
    '| Repository |',
    '| Revision at capture |',
    '| Command or URL |',
    '| Network or mock mode |',
    '| Viewport |',
    '| Scenario state |',
    '| Alt text |',
    '| Last reviewed |',
    '| Stale-proof owner |',
  ]

  /** A raster is a photograph of a running program; an SVG here is a drawing. */
  const isCapture = (path: string): boolean => /\.(png|webp|jpe?g|gif|avif)$/i.test(path)

  interface Use {
    page: string
    alt: string
    at: number
  }

  const uses = new Map<string, Use[]>()
  for (const page of docPages()) {
    const markdown = source(page)
    for (const match of markdown.matchAll(IMAGE)) {
      const [full, alt = '', path = ''] = match
      const list = uses.get(path) ?? []
      list.push({ page, alt, at: (match.index ?? 0) + full.length })
      uses.set(path, list)
    }
  }

  test('every referenced image exists and no image is shipped unreferenced', () => {
    expect(uses.size).toBeGreaterThan(0)

    for (const path of uses.keys()) {
      expect(existsSync(join(root, 'docs', 'public', path)), `${path} is referenced and missing`).toBeTrue()
    }

    const shipped = readdirSync(join(root, 'docs', 'public', 'img', 'docs')).sort()
    for (const file of shipped) {
      expect([...uses.keys()], `${file} is shipped but no page uses it`).toContain(`/img/docs/${file}`)
    }
  })

  for (const [path, list] of uses) {
    if (!isCapture(path)) continue
    const record = `docs/evidence/${(path.split('/').pop() as string).replace(/\.[^.]+$/, '')}.md`
    const include = `<!--@include: @/evidence/${record.split('/').pop()}-->`

    test(`${path} has one provenance record, rendered wherever it appears`, () => {
      expect(existsSync(join(root, record)), `${path} has no record at ${record}`).toBeTrue()

      for (const use of list) {
        const markdown = source(use.page)
        const at = markdown.indexOf(include)
        expect(at, `${use.page} shows ${path} without its provenance record`).toBeGreaterThan(-1)
        expect(at, `${use.page} puts the record before the image`).toBeGreaterThan(use.at)
      }
    })

    test(`${path} records every field the contract asks for`, () => {
      const provenance = source(record)
      for (const row of CONTRACT_ROWS) {
        expect(provenance, `${record} is missing ${row}`).toContain(row)
      }

      // One alt string per image, and the record quotes the one in use.
      const alts = new Set(list.map((use) => use.alt))
      expect(alts.size, `${path} is described differently on different pages`).toBe(1)
      expect(provenance).toContain([...alts][0] as string)

      // The rule the contract turns on: a field nobody recorded means the state
      // cannot be re-created, and an unreproducible capture is not evidence.
      if (provenance.includes('**Not recorded.**')) {
        expect(provenance, `${record} hides an unrecorded field behind an evidence claim`).toContain(
          'illustration, not runtime evidence',
        )
      }
    })
  }

  test('the drawings are code-native and describe themselves', () => {
    for (const path of uses.keys()) {
      if (isCapture(path)) continue
      expect(path.endsWith('.svg'), `${path} is neither a capture nor an SVG diagram`).toBeTrue()

      const svg = readFileSync(join(root, 'docs', 'public', path), 'utf8')
      expect(svg, `${path} has no <title>`).toContain('<title')
      expect(svg, `${path} has no <desc>`).toContain('<desc')
      expect(svg, `${path} is not text a reviewer can diff`).not.toContain('<image')
    }
  })

  test('no provenance record is left behind by an image nobody shows', () => {
    for (const file of readdirSync(join(root, 'docs', 'evidence'))) {
      const stem = file.replace(/\.md$/, '')
      const used = [...uses.keys()].some((path) => path.includes(`/${stem}.`))
      expect(used, `docs/evidence/${file} describes an image no page uses`).toBeTrue()
    }
  })
})
