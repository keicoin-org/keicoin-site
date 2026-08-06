/**
 * The validator that docs/future/spec-sheet.yaml promises itself.
 *
 * The sheet's `schema.policy` block states its own rules ("Everything a later
 * validator needs to implement, stated as rules."); this module implements the
 * mechanically checkable ones and keeps docs/future/spec-sheet.md a
 * deterministic rendering of the YAML rather than a second, hand-edited source
 * of truth. The YAML is canonical; the Markdown is output; `bun run spec:write`
 * is the only thing that writes it.
 *
 * What stays a review obligation rather than a false green tick: that a
 * "Closes when" condition really is checkable by the command or document it
 * names, and that no summary or risk outruns what the source documents record.
 * A prefix check cannot read evidence.
 */

const SCHEMA_NAME = 'kei-future-spec-sheet'
const SCHEMA_VERSION = '1.0.0'
const CANONICAL_PATH = 'docs/future/spec-sheet.yaml'

const STATUS_VOCABULARY = ['blocked', 'in-progress', 'non-goal', 'planned', 'shipped'] as const
const HORIZON_VOCABULARY = ['near-term', 'post-v1', 'v1'] as const
/** `non-goal` is a status only entries in `non_goals` may carry. */
const ENTRY_STATUSES = STATUS_VOCABULARY.filter((status) => status !== 'non-goal')

/**
 * A branch or merge state, offered as if it were evidence.
 *
 * keicoin-site#50: `dl-wallet-standalone`'s acceptance read "is on kei-wallet's
 * default branch" while the wallet did not build. The defect was not the stale
 * badge — it was that the acceptance line named something that stays true
 * forever regardless of what the code later does. A merge is a property of a
 * git history; it is not a property of software. This is deliberately a
 * deny-list rather than an allow-list on "checkable" phrasing (unlike, say,
 * button/server/rpc.ts's `PUBLIC_RPC_ACTIONS`): the vocabulary a reviewer uses
 * to describe checkable evidence — a URL, a version, a command, a hosted
 * record — is too open to enumerate, but the specific failure mode namely
 * "it merged" is narrow enough to name outright.
 */
const BRANCH_STATE_ONLY_PATTERN = /\b(?:on|onto)\s+[\w.-]+'s\s+default\s+branch\b|\b(?:is|was|has been)\s+merged\b|\bmerged\s+into\b/i

const TOP_LEVEL_KEYS = ['schema', 'project', 'milestones', 'non_goals'] as const
const MILESTONE_FIELDS = [
  'id',
  'title',
  'horizon',
  'status',
  'owner',
  'repositories',
  'summary',
  'dependencies',
  'blocked_by',
  'acceptance',
  'risks',
  'deliverables',
] as const
const DELIVERABLE_FIELDS = [
  'id',
  'title',
  'status',
  'repositories',
  'summary',
  'dependencies',
  'blocked_by',
  'acceptance',
] as const
const NON_GOAL_FIELDS = ['id', 'title', 'status', 'reason', 'source'] as const

const ID_PATTERN = {
  milestone: /^ms-[a-z0-9-]+$/,
  deliverable: /^dl-[a-z0-9-]+$/,
  'non-goal': /^ng-[a-z0-9-]+$/,
} as const

interface SpecEntry {
  id: string
  title: string
  status: string
  repositories: string[]
  summary: string
  dependencies: string[]
  blocked_by?: string[]
  acceptance: string[]
}

export type SpecDeliverable = SpecEntry
export type SpecMilestone = SpecEntry & {
  horizon: string
  owner: string
  risks: string[]
  deliverables: SpecDeliverable[]
}
export interface SpecNonGoal {
  id: string
  title: string
  status: string
  reason: string
  source: string
}
export interface SpecSheet {
  schema: {
    name: string
    version: string
    canonical_path: string
    authored_by: string
    vocabularies: { status: string[]; horizon: string[] }
    field_order: { milestone: string[]; deliverable: string[]; non_goal: string[] }
    policy: string[]
  }
  project: {
    name: string
    thesis: string
    definition_of_v1: string
    source_documents: Array<{ path: string; role: string }>
  }
  milestones: SpecMilestone[]
  non_goals: SpecNonGoal[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isNonEmptyString)
/** The string members of a possibly malformed list, so one bad item does not hide every other check. */
const stringItems = (value: unknown): string[] => (Array.isArray(value) ? value.filter(isNonEmptyString) : [])

function checkExactList(actual: unknown, expected: readonly string[], label: string, errors: string[]): void {
  if (!isStringList(actual) || actual.length !== expected.length || actual.some((item, i) => item !== expected[i])) {
    errors.push(`${label} must be exactly [${expected.join(', ')}]`)
  }
}

/** Lexical (byte-wise) ascending order; ids are ASCII so `<` on strings is byte order. */
function checkAscending(ids: string[], label: string, errors: string[]): void {
  for (let i = 1; i < ids.length; i++) {
    const previous = ids[i - 1]!
    const next = ids[i]!
    if (!(previous < next)) errors.push(`${label} out of lexical order: "${next}" follows "${previous}"`)
  }
}

/** First cycle in deterministic order (nodes and edges visited sorted), or null. */
function findCycle(edges: Map<string, string[]>): string[] | null {
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []
  const visit = (node: string): string[] | null => {
    state.set(node, 'visiting')
    stack.push(node)
    for (const next of edges.get(node) ?? []) {
      const seen = state.get(next)
      if (seen === 'visiting') return [...stack.slice(stack.indexOf(next)), next]
      if (seen === undefined) {
        const cycle = visit(next)
        if (cycle) return cycle
      }
    }
    state.set(node, 'done')
    stack.pop()
    return null
  }
  for (const node of [...edges.keys()].sort()) {
    if (!state.has(node)) {
      const cycle = visit(node)
      if (cycle) return cycle
    }
  }
  return null
}

function checkSchemaBlock(schema: unknown, errors: string[]): void {
  if (!isRecord(schema)) {
    errors.push('schema must be a mapping')
    return
  }
  if (schema.name !== SCHEMA_NAME) errors.push(`schema.name must be "${SCHEMA_NAME}"`)
  if (schema.version !== SCHEMA_VERSION) {
    errors.push(`schema.version is ${JSON.stringify(schema.version)}; this validator implements "${SCHEMA_VERSION}"`)
  }
  if (schema.canonical_path !== CANONICAL_PATH) errors.push(`schema.canonical_path must be "${CANONICAL_PATH}"`)
  if (!isNonEmptyString(schema.authored_by)) errors.push('schema.authored_by must be a non-empty string')
  const vocabularies = isRecord(schema.vocabularies) ? schema.vocabularies : {}
  checkExactList(vocabularies.status, STATUS_VOCABULARY, 'schema.vocabularies.status', errors)
  checkExactList(vocabularies.horizon, HORIZON_VOCABULARY, 'schema.vocabularies.horizon', errors)
  const fieldOrder = isRecord(schema.field_order) ? schema.field_order : {}
  checkExactList(fieldOrder.milestone, MILESTONE_FIELDS, 'schema.field_order.milestone', errors)
  checkExactList(fieldOrder.deliverable, DELIVERABLE_FIELDS, 'schema.field_order.deliverable', errors)
  checkExactList(fieldOrder.non_goal, NON_GOAL_FIELDS, 'schema.field_order.non_goal', errors)
  if (!isStringList(schema.policy) || schema.policy.length === 0) {
    errors.push('schema.policy must be a non-empty list of rules')
  }
}

function checkProjectBlock(project: unknown, errors: string[]): void {
  if (!isRecord(project)) {
    errors.push('project must be a mapping')
    return
  }
  for (const field of ['name', 'thesis', 'definition_of_v1'] as const) {
    if (!isNonEmptyString(project[field])) errors.push(`project.${field} must be a non-empty string`)
  }
  const documents = project.source_documents
  if (!Array.isArray(documents) || documents.length === 0) {
    errors.push('project.source_documents must be a non-empty list')
    return
  }
  documents.forEach((document, index) => {
    if (!isRecord(document) || !isNonEmptyString(document.path) || !isNonEmptyString(document.role)) {
      errors.push(`project.source_documents[${index}] must carry a non-empty path and role`)
    }
  })
}

/** The fields shared by milestones and deliverables, checked one policy rule at a time. */
function checkEntry(
  raw: Record<string, unknown>,
  kind: 'milestone' | 'deliverable',
  label: string,
  errors: string[],
): void {
  const fields = kind === 'milestone' ? MILESTONE_FIELDS : DELIVERABLE_FIELDS
  if ('blocked_by' in raw && raw.status !== 'blocked') {
    errors.push(`${label}: blocked_by is forbidden unless status is "blocked"`)
  }
  if (!('blocked_by' in raw) && raw.status === 'blocked') {
    errors.push(`${label}: blocked_by is required when status is "blocked"`)
  }
  // Presence and order in one comparison: every named field, in the declared
  // field_order, with nothing extra. blocked_by presence is judged above, so
  // here it is expected exactly when it appears.
  const expected = fields.filter((field) => field !== 'blocked_by' || 'blocked_by' in raw)
  const actual = Object.keys(raw)
  if (actual.length !== expected.length || actual.some((key, i) => key !== expected[i])) {
    errors.push(`${label}: keys must be exactly [${expected.join(', ')}] in that order; got [${actual.join(', ')}]`)
  }

  const pattern = ID_PATTERN[kind]
  if (!isNonEmptyString(raw.id) || !pattern.test(raw.id)) {
    errors.push(`${label}: id must match ${pattern}`)
  }
  if (!isNonEmptyString(raw.title)) errors.push(`${label}: title must be a non-empty string`)
  if (!isNonEmptyString(raw.summary)) errors.push(`${label}: summary must be a non-empty string`)

  const status = raw.status
  if (status === 'non-goal') {
    errors.push(`${label}: status "non-goal" is only for non_goals entries`)
  } else if (!isNonEmptyString(status) || !ENTRY_STATUSES.includes(status as (typeof ENTRY_STATUSES)[number])) {
    errors.push(`${label}: status ${JSON.stringify(status)} is not in the status vocabulary (${ENTRY_STATUSES.join(', ')})`)
  }

  if (!isStringList(raw.repositories) || raw.repositories.length === 0) {
    errors.push(`${label}: repositories must be a non-empty list of repository names`)
  } else if (new Set(raw.repositories).size !== raw.repositories.length) {
    errors.push(`${label}: repositories must not repeat`)
  }

  if (!Array.isArray(raw.dependencies) || !raw.dependencies.every(isNonEmptyString)) {
    errors.push(`${label}: dependencies must be a list of ids (it may be empty)`)
  }
  if ('blocked_by' in raw && (!isStringList(raw.blocked_by) || raw.blocked_by.length === 0)) {
    errors.push(`${label}: blocked_by must be a non-empty list of ids when present`)
  }

  if (!isStringList(raw.acceptance) || raw.acceptance.length === 0) {
    errors.push(`${label}: acceptance must be a non-empty list`)
  } else {
    raw.acceptance.forEach((line, index) => {
      if (!line.startsWith('Verified: ') && !line.startsWith('Closes when: ')) {
        errors.push(`${label}: acceptance line ${index + 1} must begin with "Verified: " or "Closes when: "`)
      }
    })
    if (status === 'shipped' && !raw.acceptance.some((line) => line.startsWith('Verified: '))) {
      errors.push(`${label}: a shipped entry needs at least one "Verified: " acceptance line`)
    }
    if (status === 'shipped') {
      raw.acceptance.forEach((line, index) => {
        if (line.startsWith('Verified: ') && BRANCH_STATE_ONLY_PATTERN.test(line)) {
          errors.push(
            `${label}: acceptance line ${index + 1} names a branch or merge state as its evidence ("${line}") — that stays true forever regardless of what the code later does. Name a URL, a published registry version, or a runnable command instead.`,
          )
        }
      })
    }
    if (
      (status === 'planned' || status === 'in-progress' || status === 'blocked') &&
      !raw.acceptance.some((line) => line.startsWith('Closes when: '))
    ) {
      errors.push(`${label}: a ${status} entry needs at least one "Closes when: " acceptance line`)
    }
  }

  if (kind === 'milestone') {
    if (!isNonEmptyString(raw.horizon) || !HORIZON_VOCABULARY.includes(raw.horizon as (typeof HORIZON_VOCABULARY)[number])) {
      errors.push(`${label}: horizon ${JSON.stringify(raw.horizon)} is not in the horizon vocabulary (${HORIZON_VOCABULARY.join(', ')})`)
    }
    if (!isNonEmptyString(raw.owner)) {
      errors.push(`${label}: owner must be a non-empty string`)
    } else if (raw.owner !== 'project' && isStringList(raw.repositories) && !raw.repositories.includes(raw.owner)) {
      errors.push(`${label}: owner must be one of the entry's repositories or "project"`)
    }
    if (!isStringList(raw.risks) || raw.risks.length === 0) {
      errors.push(`${label}: risks must be a non-empty list`)
    }
  }
}

export function validateSpecSheet(yamlText: string): string[] {
  const errors: string[] = []
  let root: unknown
  try {
    root = Bun.YAML.parse(yamlText)
  } catch (cause) {
    return [`YAML parse error: ${cause instanceof Error ? cause.message : String(cause)}`]
  }
  if (!isRecord(root)) return ['the document must be a YAML mapping']

  const topLevel = Object.keys(root)
  if (topLevel.length !== TOP_LEVEL_KEYS.length || topLevel.some((key, i) => key !== TOP_LEVEL_KEYS[i])) {
    errors.push(`top-level keys must be exactly [${TOP_LEVEL_KEYS.join(', ')}] in that order; got [${topLevel.join(', ')}]`)
  }

  checkSchemaBlock(root.schema, errors)
  checkProjectBlock(root.project, errors)

  // One registry across the whole document: ids are globally unique, and only
  // milestones and deliverables may be referenced by dependencies/blocked_by.
  const seen = new Map<string, string>()
  const referenceable = new Set<string>()
  const graphed: Array<{ id: string; label: string; dependencies: string[]; blocked_by: string[] }> = []
  const register = (id: unknown, label: string, isReferenceTarget: boolean): void => {
    if (!isNonEmptyString(id)) return
    const first = seen.get(id)
    if (first) errors.push(`id "${id}" is declared more than once (${first} and ${label})`)
    else seen.set(id, label)
    if (isReferenceTarget) referenceable.add(id)
  }

  const milestones = root.milestones
  const milestoneIds: string[] = []
  if (!Array.isArray(milestones) || milestones.length === 0) {
    errors.push('milestones must be a non-empty list')
  } else {
    milestones.forEach((rawMilestone, index) => {
      const path = `milestones[${index}]`
      if (!isRecord(rawMilestone)) {
        errors.push(`${path} must be a mapping`)
        return
      }
      const label = isNonEmptyString(rawMilestone.id) ? `milestone "${rawMilestone.id}"` : path
      checkEntry(rawMilestone, 'milestone', label, errors)
      register(rawMilestone.id, label, true)
      if (isNonEmptyString(rawMilestone.id)) {
        milestoneIds.push(rawMilestone.id)
        graphed.push({
          id: rawMilestone.id,
          label,
          dependencies: stringItems(rawMilestone.dependencies),
          blocked_by: stringItems(rawMilestone.blocked_by),
        })
      }

      const deliverables = rawMilestone.deliverables
      if (!Array.isArray(deliverables) || deliverables.length === 0) {
        errors.push(`${label}: deliverables must be a non-empty list — a milestone with nothing to deliver is a heading, not a milestone`)
        return
      }
      const deliverableIds: string[] = []
      deliverables.forEach((rawDeliverable, deliverableIndex) => {
        const deliverablePath = `${path}.deliverables[${deliverableIndex}]`
        if (!isRecord(rawDeliverable)) {
          errors.push(`${deliverablePath} must be a mapping`)
          return
        }
        const deliverableLabel = isNonEmptyString(rawDeliverable.id)
          ? `deliverable "${rawDeliverable.id}"`
          : deliverablePath
        checkEntry(rawDeliverable, 'deliverable', deliverableLabel, errors)
        register(rawDeliverable.id, deliverableLabel, true)
        if (isNonEmptyString(rawDeliverable.id)) {
          deliverableIds.push(rawDeliverable.id)
          graphed.push({
            id: rawDeliverable.id,
            label: deliverableLabel,
            dependencies: stringItems(rawDeliverable.dependencies),
            blocked_by: stringItems(rawDeliverable.blocked_by),
          })
        }
      })
      checkAscending(deliverableIds, `deliverables of ${label}`, errors)
    })
  }
  checkAscending(milestoneIds, 'milestones', errors)

  const nonGoals = root.non_goals
  const nonGoalIds: string[] = []
  if (!Array.isArray(nonGoals) || nonGoals.length === 0) {
    errors.push('non_goals must be a non-empty list — the refusals are part of the sheet, not an appendix')
  } else {
    nonGoals.forEach((rawNonGoal, index) => {
      const path = `non_goals[${index}]`
      if (!isRecord(rawNonGoal)) {
        errors.push(`${path} must be a mapping`)
        return
      }
      const label = isNonEmptyString(rawNonGoal.id) ? `non-goal "${rawNonGoal.id}"` : path
      const actual = Object.keys(rawNonGoal)
      if (actual.length !== NON_GOAL_FIELDS.length || actual.some((key, i) => key !== NON_GOAL_FIELDS[i])) {
        errors.push(`${label}: keys must be exactly [${NON_GOAL_FIELDS.join(', ')}] in that order; got [${actual.join(', ')}]`)
      }
      if (!isNonEmptyString(rawNonGoal.id) || !ID_PATTERN['non-goal'].test(rawNonGoal.id)) {
        errors.push(`${label}: id must match ${ID_PATTERN['non-goal']}`)
      }
      if (rawNonGoal.status !== 'non-goal') {
        errors.push(`${label}: status must be "non-goal"`)
      }
      for (const field of ['title', 'reason', 'source'] as const) {
        if (!isNonEmptyString(rawNonGoal[field])) errors.push(`${label}: ${field} must be a non-empty string`)
      }
      register(rawNonGoal.id, label, false)
      if (isNonEmptyString(rawNonGoal.id)) nonGoalIds.push(rawNonGoal.id)
    })
  }
  checkAscending(nonGoalIds, 'non_goals', errors)

  // References resolve, nothing depends on itself, and the graph over
  // dependencies plus blocked_by has no cycle.
  const edges = new Map<string, string[]>()
  for (const entry of graphed) {
    const valid: string[] = []
    for (const [field, refs] of [
      ['dependencies', entry.dependencies],
      ['blocked_by', entry.blocked_by],
    ] as const) {
      for (const ref of refs) {
        if (ref === entry.id) {
          errors.push(`${entry.label}: ${field} entry "${ref}" depends on itself`)
        } else if (!referenceable.has(ref)) {
          errors.push(`${entry.label}: ${field} names "${ref}", which is not a declared milestone or deliverable id`)
        } else {
          valid.push(ref)
        }
      }
    }
    edges.set(entry.id, [...new Set(valid)].sort())
  }
  const cycle = findCycle(edges)
  if (cycle) errors.push(`dependency cycle: ${cycle.join(' -> ')}`)

  return errors
}

/**
 * The deterministic rendering of a valid sheet. Pure in the YAML text: same
 * input, same output, byte for byte — that determinism is what lets a byte
 * comparison stand in for a consistency proof between the two files.
 */
export function renderSpecSheetMarkdown(yamlText: string): string {
  const problems = validateSpecSheet(yamlText)
  if (problems.length > 0) {
    throw new Error(`cannot render an invalid spec sheet:\n- ${problems.join('\n- ')}`)
  }
  const doc = Bun.YAML.parse(yamlText) as unknown as SpecSheet
  const { schema, project } = doc

  const code = (value: string): string => `\`${value}\``
  const anchor = (id: string): string => `[${code(id)}](#${id})`
  const BADGE_TYPE: Record<string, string> = {
    shipped: 'tip',
    'in-progress': 'warning',
    planned: 'info',
    blocked: 'danger',
  }
  const badge = (status: string): string => `<Badge type="${BADGE_TYPE[status] ?? 'info'}" text="${status}" />`
  const deliverableCounts = (milestone: SpecMilestone): string =>
    ENTRY_STATUSES.map((status) => [status, milestone.deliverables.filter((d) => d.status === status).length] as const)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => `${count} ${status}`)
      .join(' · ')

  const lines: string[] = []
  const push = (...next: string[]): void => {
    lines.push(...next)
  }
  const references = (label: string, refs: string[] | undefined): void => {
    if (refs && refs.length > 0) push(`**${label}:** ${refs.map(anchor).join(', ')}.`, '')
  }

  push(
    '---',
    'title: Future spec sheet',
    'description: What is shipped, in progress, planned, blocked, and refused, per milestone and deliverable — rendered from the canonical spec-sheet.yaml.',
    '---',
    '',
    '<!--',
    '  GENERATED FILE — do not edit by hand.',
    '  Rendered deterministically from docs/future/spec-sheet.yaml by `bun run spec:write`;',
    '  `bun run spec:check` and src/site/spec-sheet.test.ts fail on any drift between the two.',
    '-->',
    '',
    `# ${project.name} future spec sheet`,
    '',
    project.thesis,
    '',
    `**Definition of v1.** ${project.definition_of_v1}`,
    '',
    `**Authorship.** ${schema.authored_by}.`,
    '',
    '::: info How to read this page',
    `This page is rendered from [${code(schema.canonical_path)}](https://github.com/keicoin-org/keicoin-site/blob/master/docs/future/spec-sheet.yaml), the canonical machine-readable sheet (schema ${code(schema.name)} ${code(schema.version)}); nothing here claims more than that sheet's source documents record. Acceptance lines come in two kinds: **Verified** cites evidence already recorded in a source document, and **Closes when** states the measurable condition that would close the entry. A **blocked** entry names what it waits on, and a **non-goal** is refused on the record, not deferred.`,
    ':::',
    '',
    '## Source documents',
    '',
    ...project.source_documents.map((document) => `- **${document.path}** — ${document.role}`),
    '',
    '## Milestones at a glance',
    '',
    '| Milestone | Horizon | Status | Deliverables |',
    '| --- | --- | --- | --- |',
    ...doc.milestones.map(
      (milestone) =>
        `| [${milestone.title}](#${milestone.id}) | ${code(milestone.horizon)} | ${badge(milestone.status)} | ${deliverableCounts(milestone)} |`,
    ),
  )

  for (const milestone of doc.milestones) {
    push(
      '',
      `## ${milestone.title} {#${milestone.id}}`,
      '',
      `${badge(milestone.status)} · horizon ${code(milestone.horizon)} · owner ${code(milestone.owner)} · repositories ${milestone.repositories.map(code).join(', ')}`,
      '',
      milestone.summary,
      '',
    )
    references('Depends on', milestone.dependencies)
    references('Blocked by', milestone.blocked_by)
    push('**Acceptance**', '')
    for (const line of milestone.acceptance) push(`- ${line}`)
    push('', '**Risks**', '')
    for (const risk of milestone.risks) push(`- ${risk}`)
    for (const deliverable of milestone.deliverables) {
      push(
        '',
        `### ${deliverable.title} {#${deliverable.id}}`,
        '',
        `${badge(deliverable.status)} · repositories ${deliverable.repositories.map(code).join(', ')}`,
        '',
        deliverable.summary,
        '',
      )
      references('Depends on', deliverable.dependencies)
      references('Blocked by', deliverable.blocked_by)
      push('**Acceptance**', '')
      for (const line of deliverable.acceptance) push(`- ${line}`)
    }
  }

  push(
    '',
    '## Non-goals {#non-goals}',
    '',
    'What the project refuses, with the reason and its source on the record. These are decisions, not backlog.',
    '',
    ...doc.non_goals.map((nonGoal) => `- **${nonGoal.title}** ${code(nonGoal.id)} — ${nonGoal.reason} _Source: ${nonGoal.source}._`),
  )

  return lines.join('\n') + '\n'
}

/**
 * The whole contract at once: the YAML validates, and the Markdown on disk is
 * byte-identical (modulo CRLF) to the deterministic rendering. Pass `null` for
 * a missing Markdown file.
 */
export function specSheetProblems(yamlText: string, markdownText: string | null): string[] {
  const errors = validateSpecSheet(yamlText)
  if (errors.length > 0) return errors
  if (markdownText === null) {
    return ['docs/future/spec-sheet.md is missing; run `bun run spec:write` to generate it']
  }
  const normalize = (text: string): string => text.replace(/\r\n/g, '\n')
  if (normalize(markdownText) !== renderSpecSheetMarkdown(yamlText)) {
    return ['docs/future/spec-sheet.md has drifted from docs/future/spec-sheet.yaml; run `bun run spec:write` to regenerate it']
  }
  return []
}
