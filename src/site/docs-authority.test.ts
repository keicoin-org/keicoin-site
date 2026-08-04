/**
 * `/docs` is built by VitePress, not by the small generated-site renderer.
 * These checks use the actual source owner and the actual build output, so a
 * page record that the build excludes cannot make machine/human parity pass.
 */

import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PAGES } from './content.js'
import { llmsTxt } from './machine.js'

const root = join(import.meta.dir, '..', '..')
const read = (...path: string[]): string => readFileSync(join(root, ...path), 'utf8').replace(/\r\n/g, '\n')

const REQUIRED_HUMAN_CLAIMS = [
  'kei-transaction@0.7.0',
  'defineDropTable',
  'game.economy.drop',
  'kei.economy.verifyDrop',
  'kei.shop.list',
  'kei.shop.browse',
  'kei.shop.buy',
  'kei.shop.gift',
  'Not verifiable randomness',
  'not yet been run against the public testnet',
] as const

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

describe('/docs has one deployed human source', () => {
  test('PAGES contains only records the generated-site build writes', () => {
    expect(PAGES.map((page) => page.path)).not.toContain('/docs')

    const build = read('build.ts')
    expect(build).toContain('for (const page of PAGES) await write(fileFor(page.path), render(page))')
    expect(build).not.toMatch(/page\.path\s*!==\s*['"]\/docs['"]/)
  })

  test('the VitePress source mirrors the machine-readable economy claims and caveats', () => {
    const source = read('docs', 'index.md').replace(/\s+/g, ' ')
    const machine = llmsTxt()

    for (const claim of REQUIRED_HUMAN_CLAIMS) expect(source).toContain(claim)
    for (const api of REQUIRED_HUMAN_CLAIMS.slice(1, 8)) expect(machine).toContain(api)
    expect(machine).toContain('Not verifiable randomness')
    expect(machine).toContain('not yet run against the public testnet')
  })

  test('example prerequisites distinguish the current SDK from release history', () => {
    const fundamentals = read('docs', 'examples', 'button', 'fundamentals.md')

    expect(fundamentals).toContain('current published release, `0.7.0`')
    expect(fundamentals).not.toContain('current published release, `0.6.0`')
  })

  test(
    'the real build puts the required claims in dist/docs/index.html',
    () => {
      const bun = Bun.which('bun')
      if (!bun) throw new Error('Bun is required to verify the deployed VitePress build.')

      const result = spawnSync(bun, ['run', 'build'], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' },
        timeout: 120_000,
        windowsHide: true,
      })
      if (result.status !== 0) {
        throw new Error(`The real site build failed.\n${result.stdout}\n${result.stderr}`)
      }

      const built = visibleText(read('dist', 'docs', 'index.html'))
      for (const claim of REQUIRED_HUMAN_CLAIMS) expect(built).toContain(claim)
      expect(built).toContain('There is no mainnet')
      expect(built).toContain('Create Kei MMO, which is an unpublished draft')
    },
    120_000,
  )
})
