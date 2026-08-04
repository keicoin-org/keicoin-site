/**
 * `bun run spec:check` — validate docs/future/spec-sheet.yaml against its own
 * schema.policy rules and fail on any drift in docs/future/spec-sheet.md.
 * `bun run spec:write` regenerates the Markdown. The YAML is canonical and this
 * script never writes it.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { renderSpecSheetMarkdown, specSheetProblems, validateSpecSheet, type SpecSheet } from './spec-sheet.js'

const root = join(import.meta.dir, '..', '..')
const yamlPath = join(root, 'docs', 'future', 'spec-sheet.yaml')
const markdownPath = join(root, 'docs', 'future', 'spec-sheet.md')

const yamlText = readFileSync(yamlPath, 'utf8')

const schemaErrors = validateSpecSheet(yamlText)
if (schemaErrors.length > 0) {
  console.error(`docs/future/spec-sheet.yaml does not validate (${schemaErrors.length} problem${schemaErrors.length === 1 ? '' : 's'}):`)
  for (const error of schemaErrors) console.error(`  - ${error}`)
  process.exit(1)
}

if (process.argv.includes('--write')) {
  writeFileSync(markdownPath, renderSpecSheetMarkdown(yamlText))
  console.log('docs/future/spec-sheet.md regenerated from docs/future/spec-sheet.yaml')
} else {
  const markdownText = existsSync(markdownPath) ? readFileSync(markdownPath, 'utf8') : null
  const problems = specSheetProblems(yamlText, markdownText)
  if (problems.length > 0) {
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exit(1)
  }
  const doc = Bun.YAML.parse(yamlText) as unknown as SpecSheet
  const deliverables = doc.milestones.reduce((total, milestone) => total + milestone.deliverables.length, 0)
  console.log(
    `docs/future/spec-sheet.yaml valid — ${doc.milestones.length} milestones, ${deliverables} deliverables, ${doc.non_goals.length} non-goals; spec-sheet.md in sync`,
  )
}
