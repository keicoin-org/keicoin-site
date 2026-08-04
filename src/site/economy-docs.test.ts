/**
 * The `kei.economy` and `kei.shop` surfaces were published as copyable code —
 * in the quickstart, in `llms.txt` and in `AGENTS.md` — before either had a
 * reference page or a file anybody could run. This holds the two pages that
 * close that gap to the same rule the other references keep: the snippet on the
 * page is the file the command executes, and the output printed beside the
 * command is the output it actually prints.
 *
 * The limits are asserted here too, because they are the half an agent cannot
 * infer. A drop proves its binding and not its fairness, and the shop has not
 * been run against the public node.
 */

import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')
const read = (...path: string[]): string => readFileSync(join(root, ...path), 'utf8').replace(/\r\n/g, '\n')

const PAGES = [
  {
    page: 'drops.md',
    playground: 'drops.ts',
    /** The claim the page must not let a reader walk away without. */
    limit: 'This is not verifiable randomness',
  },
  {
    page: 'shop.md',
    playground: 'shop.ts',
    limit: 'It has not been run against the public testnet.',
  },
] as const

describe('the economy reference pages document files that run', () => {
  for (const { page, playground, limit } of PAGES) {
    const source = read('docs', 'reference', page)

    test(`${page} embeds the exact checked-in ${playground}`, () => {
      expect(source).toContain(`<<< ../playgrounds/${playground}`)
      expect(source).toContain(`bun run docs/playgrounds/${playground}`)
    })

    test(`${page} prints the output ${playground} really produces`, () => {
      const documented = source.match(/^# (\{.*\})$/m)?.[1]
      expect(documented, `${page} shows no sample output beside its command`).toBeString()

      const result = spawnSync(Bun.which('bun') ?? 'bun', ['run', join('docs', 'playgrounds', playground)], {
        cwd: root,
        encoding: 'utf8',
        timeout: 60_000,
        windowsHide: true,
      })

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
      expect(result.stdout.trim()).toBe(documented as string)
    }, 60_000)

    test(`${page} states its limit at the volume of its capability`, () => {
      // Unwrapped, because a claim that survives a reflow is the claim being
      // asserted; where the line breaks is not.
      const prose = source.replace(/\s+/g, ' ')

      expect(prose).toContain(limit)
      expect(prose).toContain('There is no mainnet')
      expect(prose).toContain('https://keicoin.org/status')
    })
  }

  test('the API reference nav reaches both pages', () => {
    const config = read('docs', '.vitepress', 'config.ts')

    expect(config).toContain("link: '/reference/drops'")
    expect(config).toContain("link: '/reference/shop'")
  })

  test('the quickstart sends its economy snippets to the pages that prove them', () => {
    const quickstart = read('docs', 'index.md')

    expect(quickstart).toContain('./reference/drops.md')
    expect(quickstart).toContain('./reference/shop.md')
  })
})
