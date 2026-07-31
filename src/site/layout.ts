/**
 * The page shell, and the block renderer.
 *
 * Pages are data (`content.ts`), not HTML, for one reason: the same facts have
 * to come out as a page, as `llms.txt`, and as structured data, and three
 * hand-written copies of a fact is three chances to publish a claim that is no
 * longer true. SPEC §11.5 — the site is never the source of truth for the API,
 * and it should at least be internally consistent about everything else.
 *
 * The human gets a landing page and readable sub-pages. The datasheet is
 * `/llms.txt` and `/AGENTS.md`, generated from this same data.
 */

export type Block =
  | { kind: 'prose'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'sub'; text: string }
  | { kind: 'code'; caption?: string; code: string }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'limits'; title?: string; items: string[] }
  | { kind: 'next'; links: Array<{ href: string; label: string; note?: string }> }

export interface Page {
  /** Site-absolute, no trailing slash except the root. */
  path: string
  title: string
  heading: string
  /** One sentence. Becomes the meta description and the lede. */
  summary: string
  /** How the request actually arrives. Rendered, and fed to llms.txt. */
  asks?: string[]
  blocks: Block[]
}

export const SITE = {
  origin: 'https://keicoin.org',
  name: 'Kei',
  tagline: 'Real currencies and items for browser games, on a feeless chain.',
  repo: 'https://github.com/keicoin',
  npm: 'kei-transaction',
  /** Kept in one place because it appears on every page and will change often. */
  milestone: 'M1 of eleven, M2 in progress',
  status:
    'The SDK is real and runs end to end against an in-memory mock. The node is written and compiles in CI, and has never been executed — there is no public network, and nothing anywhere holds value.',
} as const

/**
 * Written once because it is the only place the coin is described, and a
 * description of an image nobody on the team can see is worth getting right:
 * an owl rolling a boulder uphill, which is what building a chain is.
 */
export const COIN_ALT =
  'The Kei coin: an owl pushing a boulder uphill between two olive branches, ' +
  'reading UNUS KEI — one boulder — above a lyre marked with the Roman numeral one.'

const NAV: Array<[string, string]> = [
  ['/use-cases', 'use cases'],
  ['/docs', 'docs'],
  ['/examples', 'examples'],
  ['/status', 'status'],
  ['/llms.txt', 'llms.txt'],
]

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (char) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[char]};`)
}

/**
 * Inline markup, kept to three forms on purpose. A larger subset would be a
 * markdown parser, and this file should not contain a markdown parser.
 */
export function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

/** Comments, keywords and strings. Enough to read; not a tokeniser. */
function highlight(code: string): string {
  return escapeHtml(code)
    .replace(/(&#39;|')([^'\n]*)\1/g, '<span class="s">$&</span>')
    .replace(/\b(const|await|async|import|from|function|return|new|if|export)\b/g, '<span class="k">$1</span>')
    .replace(/(^|\n)(\s*\/\/[^\n]*)/g, '$1<span class="c">$2</span>')
}

function renderBlock(block: Block): string {
  switch (block.kind) {
    case 'prose':
      return `<p>${inline(block.text)}</p>`

    case 'heading':
      return `<h2 id="${slug(block.text)}">${inline(block.text)}</h2>`

    case 'sub':
      return `<h3>${inline(block.text)}</h3>`

    case 'code':
      return [
        '<figure class="code">',
        block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : '',
        `<pre><code>${highlight(block.code.trim())}</code></pre>`,
        '</figure>',
      ].join('')

    case 'table':
      return [
        '<div class="scroll"><table><thead><tr>',
        block.head.map((cell) => `<th>${inline(cell)}</th>`).join(''),
        '</tr></thead><tbody>',
        block.rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join(''),
        '</tbody></table></div>',
      ].join('')

    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul'
      return `<${tag}>${block.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`
    }

    case 'limits':
      return [
        '<div class="limits">',
        `<h4>${escapeHtml(block.title ?? 'What is not true yet')}</h4>`,
        `<ul>${block.items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`,
        '</div>',
      ].join('')

    case 'next':
      return [
        '<nav class="next">',
        block.links
          .map(
            (link) =>
              `<a href="${link.href}">${escapeHtml(link.label)}${link.note ? `<span>${escapeHtml(link.note)}</span>` : ''}</a>`,
          )
          .join(''),
        '</nav>',
      ].join('')
  }
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Head, header and footer. The body between them differs per page type. */
export function shell(options: {
  path: string
  title: string
  description: string
  body: string
  asks?: readonly string[]
  script?: string
}): string {
  const canonical = `${SITE.origin}${options.path}`
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: options.title,
    description: options.description,
    url: canonical,
    image: `${SITE.origin}/og.png`,
    isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.origin },
    about: { '@type': 'SoftwareApplication', name: SITE.npm, applicationCategory: 'DeveloperApplication' },
    ...(options.asks ? { keywords: options.asks.join(', ') } : {}),
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}</title>
<meta name="description" content="${escapeHtml(options.description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(options.title)}">
<meta property="og:description" content="${escapeHtml(options.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="website">
<meta property="og:image" content="${SITE.origin}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${escapeHtml(COIN_ALT)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#101113">
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/img/kei-coin-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap">
<a class="home" href="/"><img src="/img/kei-coin-64.png" alt="" width="26" height="26" decoding="async">kei<b>coin</b>.org</a>
${NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join('\n')}
</div></header>
<main id="main">
${options.body}
</main>
<footer class="site"><div class="wrap">
<p>${escapeHtml(SITE.name)} — ${escapeHtml(SITE.tagline)}<br>
<strong>keicoin.org is the only domain this project uses.</strong> Anything else claiming to be Kei is not.<br>
<a href="/llms.txt">llms.txt</a> · <a href="/AGENTS.md">AGENTS.md</a> · <a href="/status">status</a> · <a href="/examples">examples</a> · MIT</p>
</div></footer>
${options.script ? `<script>${options.script}</script>` : ''}
</body>
</html>
`
}

export function render(page: Page): string {
  return shell({
    path: page.path,
    title: page.title,
    description: page.summary,
    ...(page.asks ? { asks: page.asks } : {}),
    body: [
      '<div class="wrap page">',
      `<h1>${inline(page.heading)}</h1>`,
      `<p class="lede">${inline(page.summary)}</p>`,
      page.asks ? asksBlock(page.asks) : '',
      `<p class="status-line"><b>Status: ${escapeHtml(SITE.milestone)}.</b> ${escapeHtml(SITE.status)}</p>`,
      page.blocks.map(renderBlock).join('\n'),
      '</div>',
    ].join('\n'),
  })
}

function asksBlock(asks: readonly string[]): string {
  return [
    '<div class="asks">',
    '<p>You are probably here because somebody asked for</p>',
    `<ul>${asks.map((ask) => `<li>${escapeHtml(ask)}</li>`).join('')}</ul>`,
    '</div>',
  ].join('')
}
