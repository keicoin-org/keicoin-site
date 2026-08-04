/**
 * docs/future/spec-sheet.yaml promises its own validator in schema.policy;
 * this file holds src/site/spec-sheet.ts to those rules — first on the real
 * sheet and its published Markdown, then on a minimal fixture broken one rule
 * at a time, because a validator that has never seen a violation proves
 * nothing about what it would refuse.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { renderSpecSheetMarkdown, specSheetProblems, validateSpecSheet } from './spec-sheet.js'

const root = join(import.meta.dir, '..', '..')
const read = (...path: string[]): string => readFileSync(join(root, ...path), 'utf8')

const realYaml = read('docs', 'future', 'spec-sheet.yaml')
const realMarkdown = read('docs', 'future', 'spec-sheet.md')

describe('the canonical sheet', () => {
  test('validates with no problems', () => {
    expect(validateSpecSheet(realYaml)).toEqual([])
  })

  test('the published Markdown is exactly the deterministic rendering', () => {
    expect(specSheetProblems(realYaml, realMarkdown)).toEqual([])
  })

  test('rendering is deterministic', () => {
    expect(renderSpecSheetMarkdown(realYaml)).toBe(renderSpecSheetMarkdown(realYaml))
  })
})

/**
 * The smallest sheet that satisfies every rule: two milestones (one with a
 * blocked deliverable, so blocked_by semantics are exercised), a cross-milestone
 * dependency, and two non-goals. The trailing `#` comments are surgical anchors
 * for the mutations below — YAML ignores them, string replacement does not.
 */
const FIXTURE = `schema:
  name: "kei-future-spec-sheet"
  version: "1.0.0"
  canonical_path: "docs/future/spec-sheet.yaml"
  authored_by: "fixture"
  vocabularies:
    status:
      - "blocked"
      - "in-progress"
      - "non-goal"
      - "planned"
      - "shipped"
    horizon:
      - "near-term"
      - "post-v1"
      - "v1"
  field_order:
    milestone:
      - "id"
      - "title"
      - "horizon"
      - "status"
      - "owner"
      - "repositories"
      - "summary"
      - "dependencies"
      - "blocked_by"
      - "acceptance"
      - "risks"
      - "deliverables"
    deliverable:
      - "id"
      - "title"
      - "status"
      - "repositories"
      - "summary"
      - "dependencies"
      - "blocked_by"
      - "acceptance"
    non_goal:
      - "id"
      - "title"
      - "status"
      - "reason"
      - "source"
  policy:
    - "fixture"
project:
  name: "Kei"
  thesis: "fixture"
  definition_of_v1: "fixture"
  source_documents:
    - path: "SPEC.md"
      role: "fixture"
milestones:
  - id: "ms-alpha"
    title: "Alpha"
    horizon: "near-term"
    status: "in-progress"
    owner: "repo-a"
    repositories:
      - "repo-a"
    summary: "fixture"
    dependencies: [] # ms-alpha dependencies
    acceptance:
      - "Closes when: alpha closes."
    risks:
      - "fixture"
    deliverables:
      - id: "dl-alpha-one"
        title: "One"
        status: "shipped"
        repositories:
          - "repo-a"
        summary: "fixture"
        dependencies: [] # dl-alpha-one dependencies
        acceptance:
          - "Verified: one shipped."
      - id: "dl-alpha-two"
        title: "Two"
        status: "blocked"
        repositories:
          - "repo-a"
        summary: "fixture"
        dependencies: [] # dl-alpha-two dependencies
        blocked_by:
          - "dl-alpha-one"
        acceptance:
          - "Closes when: two unblocks."
  - id: "ms-beta"
    title: "Beta"
    horizon: "post-v1"
    status: "planned"
    owner: "project"
    repositories:
      - "repo-b"
    summary: "fixture"
    dependencies:
      - "ms-alpha"
    acceptance:
      - "Closes when: beta closes."
    risks:
      - "fixture"
    deliverables:
      - id: "dl-beta-one"
        title: "Beta one"
        status: "planned"
        repositories:
          - "repo-b"
        summary: "fixture"
        dependencies:
          - "dl-alpha-one"
        acceptance:
          - "Closes when: beta one closes."
non_goals:
  - id: "ng-alpha"
    title: "Refused alpha"
    status: "non-goal"
    reason: "fixture"
    source: "SPEC.md"
  - id: "ng-beta"
    title: "Refused beta"
    status: "non-goal"
    reason: "fixture"
    source: "SPEC.md"
`

/** Mutate the fixture and return the validator's verdict; a no-op replacement is a broken test, not a pass. */
function broken(from: string, to: string): string {
  const mutated = FIXTURE.replace(from, to)
  expect(mutated).not.toBe(FIXTURE)
  return validateSpecSheet(mutated).join('\n')
}

describe('the fixture', () => {
  test('validates clean, so every failure below is the mutation and nothing else', () => {
    expect(validateSpecSheet(FIXTURE)).toEqual([])
  })

  test('renders without throwing', () => {
    expect(renderSpecSheetMarkdown(FIXTURE)).toContain('# Kei future spec sheet')
  })
})

describe('the validator refuses', () => {
  test('a duplicate id', () => {
    expect(broken('- id: "dl-beta-one"', '- id: "dl-alpha-one"')).toContain('is declared more than once')
  })

  test('a reference to an id that does not exist', () => {
    expect(
      broken('dependencies:\n          - "dl-alpha-one"', 'dependencies:\n          - "dl-alpha-missing"'),
    ).toContain('not a declared milestone or deliverable id')
  })

  test('a reference to a non-goal, which is not a schedulable entry', () => {
    expect(broken('dependencies:\n          - "dl-alpha-one"', 'dependencies:\n          - "ng-alpha"')).toContain(
      'not a declared milestone or deliverable id',
    )
  })

  test('a self-dependency', () => {
    expect(
      broken('dependencies: [] # dl-alpha-two dependencies', 'dependencies:\n          - "dl-alpha-two"'),
    ).toContain('depends on itself')
  })

  test('a dependency cycle', () => {
    expect(
      broken('dependencies: [] # dl-alpha-one dependencies', 'dependencies:\n          - "dl-beta-one"'),
    ).toContain('dependency cycle')
  })

  test('a status outside the vocabulary', () => {
    expect(broken('status: "shipped"', 'status: "done"')).toContain('is not in the status vocabulary')
  })

  test('a declared vocabulary that differs from the one this validator implements', () => {
    expect(broken('      - "shipped"', '      - "done"')).toContain('schema.vocabularies.status must be exactly')
  })

  test('a schema version this validator does not implement', () => {
    expect(broken('version: "1.0.0"', 'version: "2.0.0"')).toContain('this validator implements "1.0.0"')
  })

  test('milestones out of lexical order', () => {
    expect(broken('- id: "ms-beta"', '- id: "ms-aaa"')).toContain('milestones out of lexical order')
  })

  test('deliverables out of lexical order within their milestone', () => {
    expect(broken('- id: "dl-alpha-two"', '- id: "dl-alpha-aaa"')).toContain('out of lexical order')
  })

  test('non-goals out of lexical order', () => {
    expect(broken('- id: "ng-beta"', '- id: "ng-aaa"')).toContain('non_goals out of lexical order')
  })

  test('a blocked entry with no blocked_by', () => {
    expect(broken('        blocked_by:\n          - "dl-alpha-one"\n', '')).toContain(
      'blocked_by is required when status is "blocked"',
    )
  })

  test('blocked_by on an entry that is not blocked', () => {
    expect(broken('status: "blocked"', 'status: "in-progress"')).toContain(
      'blocked_by is forbidden unless status is "blocked"',
    )
  })

  test('a shipped entry with no "Verified: " acceptance line', () => {
    expect(broken('- "Verified: one shipped."', '- "Closes when: one ships."')).toContain(
      'a shipped entry needs at least one "Verified: " acceptance line',
    )
  })

  test('a planned entry with no "Closes when: " acceptance line', () => {
    expect(broken('- "Closes when: beta one closes."', '- "Verified: prematurely."')).toContain(
      'a planned entry needs at least one "Closes when: " acceptance line',
    )
  })

  test('an acceptance line with neither prefix, which is not measurable', () => {
    expect(broken('- "Closes when: beta one closes."', '- "It works."')).toContain(
      'must begin with "Verified: " or "Closes when: "',
    )
  })

  test('an owner that is neither a repository of the entry nor "project"', () => {
    expect(broken('owner: "repo-a"', 'owner: "repo-x"')).toContain(
      `owner must be one of the entry's repositories or "project"`,
    )
  })

  test('a horizon outside the vocabulary', () => {
    expect(broken('horizon: "post-v1"', 'horizon: "someday"')).toContain('is not in the horizon vocabulary')
  })

  test('a horizon on a deliverable, where the schema forbids it', () => {
    expect(
      broken('- id: "dl-beta-one"\n        title: "Beta one"', '- id: "dl-beta-one"\n        title: "Beta one"\n        horizon: "v1"'),
    ).toContain('keys must be exactly')
  })

  test('a milestone with no deliverables', () => {
    const mutated = FIXTURE.replace(
      /    deliverables:\n      - id: "dl-beta-one"[\s\S]*?- "Closes when: beta one closes."\n/,
      '    deliverables: []\n',
    )
    expect(mutated).not.toBe(FIXTURE)
    expect(validateSpecSheet(mutated).join('\n')).toContain('deliverables must be a non-empty list')
  })
})

describe('the Markdown consistency contract', () => {
  test('a missing Markdown file is a failure, not a skip', () => {
    expect(specSheetProblems(FIXTURE, null).join('\n')).toContain('is missing')
  })

  test('any drift between YAML and Markdown is a failure', () => {
    const drifted = renderSpecSheetMarkdown(FIXTURE).replace('# Kei future spec sheet', '# Kei future spec sheet (edited)')
    expect(specSheetProblems(FIXTURE, drifted).join('\n')).toContain('has drifted')
  })

  test('CRLF line endings alone are not drift', () => {
    const crlf = renderSpecSheetMarkdown(FIXTURE).replace(/\n/g, '\r\n')
    expect(specSheetProblems(FIXTURE, crlf)).toEqual([])
  })
})
