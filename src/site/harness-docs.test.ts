/**
 * Create Kei Game is a separate repository on an unmerged branch, so nothing in
 * this build can execute the commands this page prints. These are string checks
 * on the copy, aimed at the two ways it has actually been wrong: naming the
 * superseded npm scaffolder as if it were the harness, and printing an agent
 * command the harness refuses.
 *
 * That second one is the reason the shell blocks are parsed rather than matched
 * whole. `--agent` requires an explicit `--source`; `--template button` alone
 * only implies the source at a prompt or under plain flags. A documented agent
 * command missing `--source` exits 1 with `missing_inputs`, and reads as a
 * broken harness rather than as a wrong page.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '..', '..')
const examples = readFileSync(join(root, 'docs', 'examples', 'index.md'), 'utf8')
const quickstart = readFileSync(join(root, 'docs', 'index.md'), 'utf8')
const content = readFileSync(join(root, 'src', 'site', 'content.ts'), 'utf8')
const home = readFileSync(join(root, 'src', 'site', 'home.ts'), 'utf8')
const layout = readFileSync(join(root, 'src', 'site', 'layout.ts'), 'utf8')
const publicCopy = [examples, quickstart, content, home, layout].join('\n')

/**
 * Fenced shell blocks, line continuations joined, so a flag list reads as one
 * command. Line endings are normalised first: this file is CRLF on disk, and a
 * `\n`-only pattern silently matches nothing at all rather than failing loudly.
 */
function shellCommands(markdown: string): string[] {
  return [...markdown.replace(/\r\n/g, '\n').matchAll(/```sh\n([\s\S]*?)```/g)]
    .map((block) => block[1]!.replace(/\\\n\s*/g, ' ').trim())
    .filter((command) => command.length > 0)
}

const agentCommands = shellCommands(examples).filter((command) => command.includes('--agent'))

describe('Create Kei Game documentation boundary', () => {
  test('does not advertise Starclickers or the legacy npm scaffolder as the harness', () => {
    expect(publicCopy.toLowerCase()).not.toContain('star-clicker')
    expect(publicCopy.toLowerCase()).not.toContain('starclicker')
    expect(publicCopy).not.toContain('npm create kei-game')
    expect(publicCopy).not.toContain('npx create-kei-game')
  })

  test('states that npm 0.2 is legacy and the standalone harness is unreleased', () => {
    expect(examples).toContain('`create-kei-game@0.2.0` on npm is the superseded package')
    expect(examples).toContain('unpublished development draft')
    expect(examples).toContain('model/tool loop, Kei terminal UI, and persisted workflow are not released yet')
  })

  test('documents both human onboarding and hard no-prompt agent mode', () => {
    expect(examples).toContain('bun run src/index.ts --')
    expect(examples).toContain('--agent --json')
    expect(examples).toContain('--api-key-env OPENAI_API_KEY')
  })

  test('every agent command carries the inputs agent mode requires', () => {
    expect(agentCommands.length).toBeGreaterThan(0)
    for (const command of agentCommands) {
      // The harness's own required set. `--yes` is the other no-prompt mode and
      // the parser refuses the two together, so it must never appear here.
      for (const flag of ['--source', '--provider', '--model', '--api-key-env', '--brief']) {
        expect(command).toContain(flag)
      }
      expect(command).not.toContain('--yes')
    }
  })

  test('a documented --template agent command spells out --source template', () => {
    for (const command of agentCommands.filter((one) => one.includes('--template'))) {
      expect(command).toContain('--source template')
    }
  })

  test('says why agent mode needs the source that a prompt can infer', () => {
    expect(examples).toContain('**Agent mode requires `--source` spelled out.**')
    expect(examples).toContain('"missing":["source"]')
  })

  test('describes templates as clones of the real repositories, not bundled copies', () => {
    expect(examples).toContain('the harness generates no game and carries no bundled template')
    expect(examples).toContain('Choosing an example clones its real repository')
  })

  test('states that the key environment variable must already hold a value', () => {
    expect(examples).toContain('has to already hold a key')
    expect(examples).toContain('the harness reads only the name')
  })
})
