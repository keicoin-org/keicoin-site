import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')

const PLAYGROUNDS = [
  ['currency.ts', 'currency'],
  ['items.ts', 'item'],
  ['market.ts', 'market'],
] as const

describe('the snippets embedded in canonical docs are runnable', () => {
  for (const [file, kind] of PLAYGROUNDS) {
    test(`${file} runs against the in-process ledger`, () => {
      const result = spawnSync(Bun.which('bun') ?? 'bun', ['run', join('docs', 'playgrounds', file)], {
        cwd: root,
        encoding: 'utf8',
        timeout: 30_000,
        windowsHide: true,
      })

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
      expect(JSON.parse(result.stdout.trim())).toMatchObject({ kind })
    })
  }
})
