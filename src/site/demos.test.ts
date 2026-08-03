import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { DEMOS, ancestorsOf, copyDemoInto, reportLine } from './demos.js'

const demo = (name: string) => {
  const found = DEMOS.find((candidate) => candidate.name === name)
  if (!found) throw new Error(`No mapping for ${name}.`)
  return found
}

describe('demo artifact mappings', () => {
  test('Carpet Markets copies the whole Next export onto the mount', () => {
    const artifacts = demo('carpet-markets').artifacts
    expect(artifacts).toHaveLength(1)
    // `_next/`, the per-coin routes and index.html all live inside this one
    // directory, so copying it whole is what makes the export complete.
    expect(artifacts[0]).toEqual({
      from: 'dist/examples/carpet-markets',
      to: '.',
      kind: 'dir',
      required: true,
    })
  })

  test('Button keeps its legacy bundle-and-page layout', () => {
    const artifacts = demo('button').artifacts
    const required = artifacts.filter((artifact) => artifact.required).map((artifact) => artifact.from)
    expect(required).toEqual(['public/build', 'index.html'])
    expect(artifacts.find((artifact) => artifact.from === 'public/build')?.to).toBe('build')
    // The page asks for ./favicon.ico relative to /examples/button/.
    expect(artifacts.some((artifact) => artifact.to === 'favicon.ico')).toBe(true)
  })

  test('no demo is copied by guessing the other one’s layout', () => {
    // The bug this file exists to prevent: one loop assuming public/build for
    // everything, which is a silent skip for a demo that does not have one.
    const shapes = DEMOS.map((entry) => entry.artifacts.map((artifact) => artifact.from).join('+'))
    expect(new Set(shapes).size).toBe(DEMOS.length)
  })
})

describe('finding the sibling checkouts', () => {
  test('walks up, nearest first', () => {
    expect(ancestorsOf('/home/dev/kei/keicoin-site')).toEqual(['/home/dev/kei', '/home/dev', '/home'])
  })

  test('reaches the checkouts from inside a git worktree', () => {
    // The layout this actually runs in: kei/.worktrees/<branch>, where the
    // demos are two levels up rather than one. Nothing hardcodes either.
    const ancestors = ancestorsOf('C:\\Users\\dev\\kei\\.worktrees\\a-branch', '\\')
    expect(ancestors[0]).toBe('C:\\Users\\dev\\kei\\.worktrees')
    expect(ancestors[1]).toBe('C:\\Users\\dev\\kei')
  })
})

describe('copying, against a checkout shaped like the real ones', () => {
  let scratch = ''
  beforeAll(async () => {
    scratch = await mkdtemp(join(tmpdir(), 'keicoin-demos-'))
  })
  afterAll(async () => {
    await rm(scratch, { recursive: true, force: true })
  })

  /** A site checked out at `<root>/.worktrees/<branch>`, demos at `<root>/<name>`. */
  const site = (): string => join(scratch, 'kei', '.worktrees', 'a-branch')

  const write = async (path: string, contents = 'x'): Promise<void> => {
    await mkdir(join(path, '..'), { recursive: true })
    await writeFile(path, contents)
  }

  test('the Next export lands whole, `_next` and the nested routes included', async () => {
    const checkout = join(scratch, 'kei', 'carpet-markets', 'dist', 'examples', 'carpet-markets')
    await write(join(checkout, 'index.html'))
    await write(join(checkout, '_next', 'static', 'chunks', 'main.js'))
    await write(join(checkout, 'coin', 'index.html'))

    const mount = join(scratch, 'out', 'examples', 'carpet-markets')
    const report = await copyDemoInto(demo('carpet-markets'), site(), mount)

    expect(report.state).toBe('copied')
    expect(existsSync(join(mount, 'index.html'))).toBe(true)
    // The one that a `public/build` assumption drops on the floor.
    expect(existsSync(join(mount, '_next', 'static', 'chunks', 'main.js'))).toBe(true)
    expect(existsSync(join(mount, 'coin', 'index.html'))).toBe(true)
  })

  test('an unbuilt demo warns instead of shipping an empty mount', async () => {
    await mkdir(join(scratch, 'kei', 'button'), { recursive: true })
    const mount = join(scratch, 'out', 'examples', 'button')
    const report = await copyDemoInto(demo('button'), site(), mount)

    expect(report.state).toBe('not-built')
    expect(existsSync(mount)).toBe(false)
    expect(reportLine(report)).toContain('public/build')
  })

  test('a missing checkout is a warning, not a throw', async () => {
    const report = await copyDemoInto(demo('button'), join(scratch, 'nowhere', 'deeper'), join(scratch, 'out', 'x'))
    expect(report.state).toBe('no-checkout')
  })
})

describe('warnings', () => {
  test('a missing checkout says where it looked', () => {
    const line = reportLine({ demo: 'button', state: 'no-checkout', searched: ['/kei/.worktrees', '/kei'] })
    expect(line).toContain('no button/ checkout')
    expect(line).toContain('/kei/.worktrees, /kei')
  })

  test('an unbuilt checkout names the path and the command', () => {
    const line = reportLine({
      demo: 'carpet-markets',
      state: 'not-built',
      from: '/kei/carpet-markets',
      missing: ['dist/examples/carpet-markets'],
      build: 'bun run build:site',
    })
    expect(line).toContain('dist/examples/carpet-markets missing')
    expect(line).toContain('`bun run build:site`')
    expect(line).toContain('/kei/carpet-markets')
  })
})
