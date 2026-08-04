/**
 * Writes `dist/`. That is the whole build.
 *
 * No framework, no bundler, no hydration: the site is text, and text is what
 * Cloudflare should be handing out. The one script on the page is the hero
 * button, inlined.
 *
 * If a sibling demo checkout in `DEMOS` has been built, its client is copied to
 * `/examples/<name>` so a local `wrangler dev` serves what production does.
 */

import { mkdir, readdir, rm, copyFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

import { PAGES } from './src/site/content.js'
import { DEMOS, copyDemoInto, reportLine } from './src/site/demos.js'
import { homePage } from './src/site/home.js'
import { render } from './src/site/layout.js'
import { agentsMd, llmsTxt, robotsTxt, sitemapXml } from './src/site/machine.js'

const root = new URL('.', import.meta.url)
const here = (path: string): string => join(Bun.fileURLToPath(root), path)

const dist = here('dist')
await mkdir(dist, { recursive: true })
// Emptied rather than removed: on Windows a preview server or an open handle
// locks the directory itself, and a build that fails because something is
// reading its output is a bad afternoon for no reason.
for (const entry of await readdir(dist)) {
  await rm(join(dist, entry), { recursive: true, force: true }).catch(() => undefined)
}

async function write(path: string, contents: string): Promise<void> {
  const target = join(dist, path)
  await mkdir(dirname(target), { recursive: true })
  await Bun.write(target, contents)
}

/** `/use-cases/inventory-system` → `use-cases/inventory-system/index.html`. */
const fileFor = (path: string): string => (path === '/' ? 'index.html' : `${path.replace(/^\//, '')}/index.html`)

await write('index.html', homePage())
// VitePress owns /docs from docs/index.md. PAGES contains only pages this loop
// actually writes, so a non-rendered record cannot satisfy a source-parity test.
for (const page of PAGES) await write(fileFor(page.path), render(page))

await write('styles.css', await Bun.file(here('src/site/styles.css')).text())

// The homepage clicker is the site's one hydrated island. Bundle the public
// player SDK into a browser module; no issuer key or server-only entry point is
// present in the page.
const clicker = await Bun.build({
  entrypoints: [here('src/site/clicker-client.ts')],
  target: 'browser',
  format: 'esm',
  minify: true,
  splitting: true,
})
if (!clicker.success || !clicker.outputs[0]) {
  throw new AggregateError(clicker.logs, 'Could not build the homepage testnet clicker.')
}
for (const output of clicker.outputs) {
  await write(output.kind === 'entry-point' ? 'clicker.js' : basename(output.path), await output.text())
}

// Static passthrough — anything in public/ lands at the same path in dist/,
// which is where the coin (favicon.ico, the PNG icons, og.png) comes from.
const publicDir = here('public')
if (existsSync(publicDir)) await copyDir(publicDir, dist)
await write('llms.txt', llmsTxt())
await write('AGENTS.md', agentsMd())
await write('robots.txt', robotsTxt())
// The demos are on other Workers' routes, so nothing here writes them and
// nothing here would otherwise list them. `/docs/*` is VitePress's own sitemap,
// except the examples index, which is linked from the header of every page.
await write(
  'sitemap.xml',
  sitemapXml([
    '/',
    ...PAGES.map((page) => page.path),
    '/docs',
    '/docs/examples',
    '/examples/button',
    '/examples/carpet-markets',
  ]),
)

// The demos, if they have been built next door. Their own repos own building
// them, and in production their own Workers own their routes — more specific
// than this site's, so they win. Copying here is what makes a local
// `wrangler dev` serve what production serves. A missing build is a warning
// rather than a broken site — but a *precise* warning, because the two demos
// have different artifacts now and "run bun run build" pointed at the wrong
// directory is how a demo silently stops being copied.
// The checkouts are found by walking up rather than by a fixed `../<name>`:
// `here('..')` is the sibling directory in an ordinary checkout and
// `.worktrees/` when the work is happening in a git worktree, and neither path
// is written down here.
for (const demo of DEMOS) {
  console.log(reportLine(await copyDemoInto(demo, Bun.fileURLToPath(root), join(dist, 'examples', demo.name))))
}

const count = await countFiles(dist)
console.log(`\n  keicoin.org → dist/ (${count} files)\n`)

async function copyDir(from: string, to: string): Promise<void> {
  await mkdir(to, { recursive: true })
  for (const entry of await readdir(from)) {
    const source = join(from, entry)
    if ((await stat(source)).isDirectory()) await copyDir(source, join(to, entry))
    else await copyFile(source, join(to, entry))
  }
}

async function countFiles(directory: string): Promise<number> {
  let total = 0
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry)
    total += (await stat(path)).isDirectory() ? await countFiles(path) : 1
  }
  return total
}
