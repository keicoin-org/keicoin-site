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
    expect(examples).toContain('`--template` is the compatibility spelling for selecting an example')
  })
})
