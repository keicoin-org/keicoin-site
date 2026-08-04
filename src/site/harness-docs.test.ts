/**
 * Create Kei MMO is a separate repository on an unmerged branch, so nothing in
 * this build can execute the commands this page prints. These are string checks
 * on the copy, aimed at the three ways it has actually been wrong.
 *
 * 1. **Naming the superseded npm scaffolder as if it were the harness.**
 *    `create-kei-game@0.2.0` is a retired three-template scaffolder and a
 *    different product; there is no `create-kei-mmo` on npm at all.
 * 2. **Printing a command the harness refuses.** This page once documented
 *    `--source template --template button`. Those inputs are now retired and
 *    exit with an error rather than being ignored, so that command reads as a
 *    broken harness rather than as a stale page. Shell blocks are therefore
 *    parsed and inspected flag by flag rather than matched whole.
 * 3. **Implying it produces a working game.** It does not, and it is not close:
 *    it plans a project and runs one bounded engine pass at the first step of
 *    that plan. An agent cannot discount enthusiasm (SPEC §12), so the page has
 *    to say the distance rather than say "early".
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')
const read = (...path: string[]): string => readFileSync(join(root, ...path), 'utf8').replace(/\r\n/g, '\n')

const examples = read('docs', 'examples', 'index.md')
const quickstart = read('docs', 'index.md')
const publicCopy = [
  examples,
  quickstart,
  read('src', 'site', 'content.ts'),
  read('src', 'site', 'home.ts'),
  read('src', 'site', 'layout.ts'),
].join('\n')

/**
 * Prose wraps, and a sentence this file cares about is usually broken across
 * two lines. Matching against the wrapped form makes every assertion here fail
 * the next time somebody reflows a paragraph, which trains people to delete the
 * test rather than fix the copy. So prose is matched with its whitespace
 * collapsed; only the shell blocks are read as written.
 */
const flat = (markdown: string): string => markdown.replace(/\s+/g, ' ')
const examplesProse = flat(examples)

/**
 * Fenced shell blocks, line continuations joined, so a flag list reads as one
 * command. `read()` has already normalised line endings: these files are CRLF
 * on disk, and a `\n`-only pattern silently matches nothing at all rather than
 * failing loudly.
 */
function shellCommands(markdown: string): string[] {
  return [...markdown.matchAll(/```sh\n([\s\S]*?)```/g)]
    .map((block) => block[1]!.replace(/\\\n\s*/g, ' ').trim())
    .filter((command) => command.length > 0)
}

/** Every fenced shell block the site publishes, wherever it publishes it. */
const allCommands = [examples, quickstart].flatMap(shellCommands)
const agentCommands = allCommands.filter((command) => command.includes('--agent'))

describe('Create Kei MMO documentation boundary', () => {
  test('does not advertise the retired scaffolder or its templates as the harness', () => {
    expect(publicCopy.toLowerCase()).not.toContain('star-clicker')
    expect(publicCopy.toLowerCase()).not.toContain('starclicker')
    expect(publicCopy).not.toContain('npm create kei-game')
    expect(publicCopy).not.toContain('npx create-kei-game')
  })

  test('states that npm carries a different, retired product and nothing else', () => {
    expect(examplesProse).toContain('`create-kei-game@0.2.0` on npm is the superseded scaffolder')
    expect(examplesProse).toContain('there is no `create-kei-mmo` package on npm')
  })

  test('says plainly that it does not produce a complete MMO yet', () => {
    expect(examplesProse).toContain('Create Kei MMO does not produce a complete MMO yet')
    expect(examplesProse).toContain('one bounded engine pass over the first step of that plan')
    // The reader who wanted a running MMO is sent to one that exists rather
    // than left waiting for this.
    expect(examplesProse).toContain('fork World of Wonder')
  })

  /**
   * VitePress cannot import `HARNESS_CRITERIA`, so the examples index quotes
   * the count in prose and this is the only thing holding the two together. It
   * said eight for as long as SPEC §11.3 had nine, which advertised a lower bar
   * than the harness sets itself.
   */
  test('points at all nine criteria, not the eight it used to list', () => {
    expect(examplesProse).toContain('nine criteria on the status page')
    expect(publicCopy).not.toMatch(/eight (?:written )?criteria/i)
  })

  test('states the 60af518 shared-encounter checkpoint without implying a complete MMO', () => {
    expect(examplesProse).toContain('criteria 2–4 are met for fresh blank 2D and Babylon.js 3D projects')
    expect(examplesProse).toContain('two headless clients observe each other move')
    expect(examplesProse).toContain('Criteria 5, 6, 8, and 9 remain open')
    expect(examplesProse).toContain('Criterion 7 remains open end to end')
    expect(examplesProse).toContain('First Shared Encounter')
    expect(examplesProse).toContain('not a complete MMO')
  })

  test('leads with the command that decides nothing on disk', () => {
    expect(examplesProse).toContain('--plan-only')
    expect(examplesProse).toContain('needs no provider, no credential, and touches no directory')
  })

  test('records that the harness asks no template question', () => {
    expect(examplesProse).toContain('Create Kei MMO asks no template question')
    expect(examplesProse).toContain('Starting blank is a normal outcome')
  })

  test('documents the hard no-prompt agent mode', () => {
    expect(examplesProse).toContain('--agent --json')
    expect(examplesProse).toContain('--api-key-env OPENAI_API_KEY')
    expect(examplesProse).toContain('never as a value')
  })

  test('every agent command carries the inputs agent mode requires', () => {
    expect(agentCommands.length).toBeGreaterThan(0)
    for (const command of agentCommands) {
      for (const flag of ['--gameplay', '--provider', '--model', '--api-key-env']) {
        expect(command).toContain(flag)
      }
      // A dimension is required and never inferred; `--2d`/`--3d` are the short
      // spellings of `--dimension`, and `--dimension auto` is a legitimate
      // explicit answer. An omitted one is not.
      expect(command).toMatch(/--(2d|3d|dimension)\b/)
      // `--yes` is the other no-prompt mode and the parser refuses the pair.
      expect(command).not.toContain('--yes')
    }
  })

  test('no published command uses an input the harness now refuses', () => {
    for (const command of allCommands) {
      expect(command).not.toMatch(/--source\b/)
      expect(command).not.toMatch(/--template\b/)
      expect(command).not.toMatch(/--from\b/)
    }
  })

  test('says those inputs are refused rather than ignored', () => {
    expect(examplesProse).toContain('`--source` and `--template` are retired, and refused')
    expect(examplesProse).toContain('They are not ignored')
  })

  test('states that the key environment variable must already hold a value', () => {
    expect(examplesProse).toContain('has to already hold a key')
    expect(examplesProse).toContain('the harness reads only the name')
  })
})
