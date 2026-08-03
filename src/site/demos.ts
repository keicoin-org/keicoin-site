/**
 * Where each demo's built client actually is, per demo.
 *
 * The two demos no longer have the same shape on disk and cannot share one
 * copy loop. Button is still a Bun bundle beside a hand-written page —
 * `public/build/` and a root `index.html`. Carpet Markets is a Next static
 * export since its PR #2, so its artifact is one directory,
 * `dist/examples/carpet-markets/`, already laid out under the URL it is served
 * at and containing `index.html`, `_next/` and the per-coin routes. Copying its
 * `public/build` — which no longer exists — is a silent skip in the old loop,
 * and a silent skip here is a deploy that ships the site without the demo.
 *
 * So the mapping is written out per demo rather than inferred, and anything
 * marked required that is missing is a warning naming the path and the command
 * that produces it.
 *
 * None of these are copied in production: each demo's own Worker owns
 * `keicoin.org/examples/<name>*` on a more specific route and serves its own
 * assets. This exists so a local `wrangler dev` of this site serves what
 * production serves.
 */

import { existsSync } from 'node:fs'
import { cp } from 'node:fs/promises'
import { join, sep } from 'node:path'

export interface Artifact {
  /** Relative to the demo's checkout root. */
  from: string
  /** Relative to `dist/examples/<name>/`. `.` is the mount itself. */
  to: string
  kind: 'dir' | 'file'
  /** A missing required artifact is a warning; a missing optional one is silent. */
  required?: boolean
}

export interface Demo {
  /** Both the sibling directory name and the mount under `/examples/`. */
  name: string
  /** Printed when a required artifact is missing. */
  build: string
  artifacts: Artifact[]
}

export const DEMOS: readonly Demo[] = [
  {
    name: 'button',
    build: 'bun run build',
    artifacts: [
      { from: 'public/build', to: 'build', kind: 'dir', required: true },
      { from: 'index.html', to: 'index.html', kind: 'file', required: true },
      // The page asks for ./favicon.ico, which at /examples/button/ is not the
      // one at the site root.
      { from: 'public/favicon.ico', to: 'favicon.ico', kind: 'file' },
      { from: 'public/kei-coin-64.png', to: 'kei-coin-64.png', kind: 'file' },
    ],
  },
  {
    name: 'carpet-markets',
    build: 'bun run build:site',
    artifacts: [
      // The whole export, `_next/` included. Next writes every URL in it with
      // the `/examples/carpet-markets` base path already applied, so the
      // directory shape has to equal the URL shape or every asset 404s in a way
      // that looks like a bug in the game.
      { from: 'dist/examples/carpet-markets', to: '.', kind: 'dir', required: true },
    ],
  },
] as const

/**
 * Ancestor directories of `from`, nearest first, as candidate parents of the
 * sibling checkouts.
 *
 * This site is checked out at `<parent>/keicoin-site` normally and at
 * `<parent>/.worktrees/<branch>` when the work is happening in a git worktree,
 * so a fixed `../<demo>` finds the demos in one of those and not the other.
 * Walking up and taking the first ancestor that has the demo in it covers both
 * without either path being written down anywhere.
 */
export function ancestorsOf(from: string, separator = '/'): string[] {
  const parts = from.split(/[\\/]/).filter((part) => part.length > 0)
  const rooted = /^[\\/]/.test(from)
  const found: string[] = []
  for (let depth = parts.length - 1; depth > 0; depth -= 1) {
    const joined = parts.slice(0, depth).join(separator)
    found.push(rooted ? `${separator}${joined}` : joined)
  }
  return found
}

/**
 * Copies one demo's artifacts into its mount, or explains precisely why it
 * could not. Split out of `build.ts` so the mapping can be exercised against a
 * fixture — a Next export with `_next/` several levels deep is exactly the
 * shape that used to be dropped silently.
 */
export async function copyDemoInto(demo: Demo, startDir: string, mount: string): Promise<DemoReport> {
  const searched = ancestorsOf(startDir, sep).slice(0, 4)
  const checkout = searched.map((parent) => join(parent, demo.name)).find((path) => existsSync(path))
  if (!checkout) return { demo: demo.name, state: 'no-checkout', searched }

  const missing = demo.artifacts
    .filter((artifact) => artifact.required && !existsSync(join(checkout, artifact.from)))
    .map((artifact) => artifact.from)
  if (missing.length > 0) {
    return { demo: demo.name, state: 'not-built', from: checkout, missing, build: demo.build }
  }

  for (const artifact of demo.artifacts) {
    const source = join(checkout, artifact.from)
    if (!existsSync(source)) continue
    await cp(source, artifact.to === '.' ? mount : join(mount, artifact.to), {
      recursive: artifact.kind === 'dir',
    })
  }
  return { demo: demo.name, state: 'copied', from: checkout }
}

export type DemoReport =
  | { demo: string; state: 'copied'; from: string }
  | { demo: string; state: 'no-checkout'; searched: string[] }
  | { demo: string; state: 'not-built'; from: string; missing: string[]; build: string }

/** One line each, precise enough to act on without opening this file. */
export function reportLine(report: DemoReport): string {
  switch (report.state) {
    case 'copied':
      return `  examples/${report.demo}  copied from ${report.from}`
    case 'no-checkout':
      return `  examples/${report.demo}  SKIPPED — no ${report.demo}/ checkout beside this one (looked in ${report.searched.join(', ')})`
    case 'not-built':
      return `  examples/${report.demo}  SKIPPED — ${report.missing.join(', ')} missing; run \`${report.build}\` in ${report.from}`
  }
}
