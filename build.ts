/**
 * Writes `dist/`. That is the whole build.
 *
 * No framework, no bundler, no hydration: the site is text, and text is what
 * Cloudflare should be handing out. The one script on the page is the hero
 * button, inlined.
 *
 * If `../button/public/build` exists, the demo is copied to `/examples/button`
 * so a local `wrangler dev` serves the same thing production does.
 */

import { mkdir, readdir, rm, copyFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { PAGES } from './src/site/content.js'
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
for (const page of PAGES) await write(fileFor(page.path), render(page))

await write('styles.css', await Bun.file(here('src/site/styles.css')).text())

// Static passthrough — anything in public/ lands at the same path in dist/,
// which is where the coin (favicon.ico, the PNG icons, og.png) comes from.
const publicDir = here('public')
if (existsSync(publicDir)) await copyDir(publicDir, dist)
await write('llms.txt', llmsTxt())
await write('AGENTS.md', agentsMd())
await write('robots.txt', robotsTxt())
await write('sitemap.xml', sitemapXml(['/', ...PAGES.map((page) => page.path), '/examples/button']))

// The demo, if it has been built next door. Its own repo owns building it; this
// only copies, so a missing build is a warning rather than a broken site.
const demo = here('../button/public/build')
if (existsSync(demo)) {
  await copyDir(demo, join(dist, 'examples/button/build'))
  await copyFile(here('../button/index.html'), join(dist, 'examples/button/index.html'))
  // The demo's page asks for ./favicon.ico, which at /examples/button/ is not
  // the one at the site root.
  const icon = here('../button/public/favicon.ico')
  if (existsSync(icon)) await copyFile(icon, join(dist, 'examples/button/favicon.ico'))
  console.log('  examples/button  copied')
} else {
  console.log('  examples/button  SKIPPED — run `bun run build` in ../button first')
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
