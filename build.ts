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
import { homePage } from './src/site/home.js'
import { render } from './src/site/layout.js'
import { agentsMd, llmsTxt, robotsTxt, sitemapXml } from './src/site/machine.js'

const root = new URL('.', import.meta.url)
const here = (path: string): string => join(Bun.fileURLToPath(root), path)

/**
 * Sibling checkouts whose built client gets copied to `/examples/<name>`.
 *
 * Only the ones whose Worker **is deployed** on that route belong here, and the
 * distinction is not pedantic. These clients are not self-contained: each one
 * talks to a mock node and a game server at `<mount>/rpc` under its own mount
 * point, served by that demo's own Worker on a path route of this zone. Copy one
 * in without its Worker and the page loads, the wallet initialises, and every
 * call after that 404s — a demo that is broken in a way a visitor discovers
 * after clicking, which is worse than a link to the repository.
 *
 * World of Wonder is an example too, and is hosted on its own domain rather than
 * copied.
 */
const DEMOS = ['button', 'carpet-markets'] as const

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
// VitePress owns /docs. The source record remains in PAGES because machine-readable
// outputs and cross-links still use its canonical URL.
for (const page of PAGES) {
  if (page.path !== '/docs') await write(fileFor(page.path), render(page))
}

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
await write('sitemap.xml', sitemapXml(['/', ...PAGES.map((page) => page.path), '/examples/button']))

// The demos, if they have been built next door. Their own repos own building
// them, and in production their own Workers own their routes — more specific
// than this site's, so they win. Copying here is what makes a local
// `wrangler dev` serve what production serves. A missing build is a warning
// rather than a broken site.
for (const demo of DEMOS) {
  const build = here(`../${demo}/public/build`)
  if (!existsSync(build)) {
    console.log(`  examples/${demo}  SKIPPED — run \`bun run build\` in ../${demo} first`)
    continue
  }
  await copyDir(build, join(dist, `examples/${demo}/build`))
  await copyFile(here(`../${demo}/index.html`), join(dist, `examples/${demo}/index.html`))
  // Each demo's page asks for ./favicon.ico, which at /examples/<demo>/ is not
  // the one at the site root.
  const icon = here(`../${demo}/public/favicon.ico`)
  if (existsSync(icon)) await copyFile(icon, join(dist, `examples/${demo}/favicon.ico`))
  console.log(`  examples/${demo}  copied`)
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
