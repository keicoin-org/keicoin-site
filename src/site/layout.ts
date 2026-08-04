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
  // The organisation, not this repository. The header's GitHub button is a
  // reader asking "where is this project's code", and the answer is six repos
  // (SPEC §1, §10) — sending them to the one that builds the marketing site is
  // the least useful of the six.
  repo: 'https://github.com/keicoin-org',
  npm: 'kei-transaction',
  /**
   * Kept in one place because it appears on every page and will change often.
   *
   * No milestone numbers. The M0–M10 ladder was retired in SPEC §13 on
   * 3 August 2026 and replaced by four concurrent tracks, so a page still
   * saying "M5" is describing a plan that no longer exists — and an agent
   * quoting it repeats a label nothing else on the internet can resolve.
   */
  milestone: 'Public testnet · no mainnet · nothing here holds value',
  status:
    'The published SDK set is 0.4.0 with `@keicoin/market` at 0.1.1, and since 3 August 2026 the public testnet settles rooted claims and atomic swaps end to end over `https://testnet.keicoin.org/rpc`. It is one rate-limited, best-effort node with weak consensus, published dev keys and no uptime promise. There is no mainnet. The demos are demos: Carpet Markets and the hosted World of Wonder run mock chains that reset, and Create Kei MMO is an unpublished draft that does not yet produce a game you can run.',
} as const

/**
 * Written once because it is the only place the coin is described, and a
 * description of an image nobody on the team can see is worth getting right:
 * an owl rolling a boulder uphill, which is what building a chain is.
 */
export const COIN_ALT =
  'The Kei coin: an owl pushing a boulder uphill between two olive branches, ' +
  'with UNUS KEI above and a lyre marked with the Roman numeral one below.'

/*
 * Dark is the site's own look rather than a mirror of the OS: the page is built
 * around a photograph of a steel button in a dark room, and on paper that is a
 * picture of a dark room lying on a desk. An explicit choice still wins, and
 * the toggle is in the header.
 */
const THEME_BOOT = `
(() => {
  try {
    const saved = localStorage.getItem('kei-theme')
    document.documentElement.dataset.theme = saved === 'light' ? 'light' : 'dark'
    document.documentElement.style.colorScheme = saved === 'light' ? 'light' : 'dark'
  } catch {}
})()
`

const THEME_SCRIPT = `
(() => {
  const root = document.documentElement
  const button = document.querySelector('.theme-toggle')
  const label = button?.querySelector('.theme-toggle-label')

  const applyTheme = (theme, save = false) => {
    root.dataset.theme = theme
    root.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#0a0b09' : '#e9e6da',
    )
    if (button && label) {
      const next = theme === 'dark' ? 'light' : 'dark'
      label.textContent = next[0].toUpperCase() + next.slice(1)
      button.setAttribute('aria-label', 'Use ' + next + ' theme')
      button.setAttribute('title', 'Use ' + next + ' theme')
    }
    if (save) {
      try { localStorage.setItem('kei-theme', theme) } catch {}
    }
  }

  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light')
  button?.addEventListener('click', () => {
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true)
  })
})()
`

/**
 * `/docs/examples` rather than `/examples`: the examples are documentation, and
 * `/examples/<name>` is where the demos themselves are mounted. `/examples`
 * redirects here (worker/index.ts) for anything already linking to it.
 *
 * Examples is deliberately not a peer of Docs in either the header or the
 * footer. It is a section *of* the documentation, and a nav that lists it
 * beside Docs tells a reader it is a separate product area — which is exactly
 * the misreading that had editorial pages living at `/examples` in the first
 * place. Here it renders as `Docs / Examples`, one group, one hierarchy.
 */
const NAV_BEFORE: Array<[string, string]> = [['/use-cases', 'Use cases']]

/** The one nested pair in the header, rendered as a single `Docs / Examples` group. */
const NAV_DOCS: Array<[string, string]> = [
  ['/docs', 'Docs'],
  ['/docs/examples', 'Examples'],
]

const NAV_AFTER: Array<[string, string]> = [
  ['/status', 'Status'],
  ['/llms.txt', 'llms.txt'],
]

/** Every header destination, in order, for anything that needs the flat list. */
export const NAV: ReadonlyArray<readonly [string, string]> = [...NAV_BEFORE, ...NAV_DOCS, ...NAV_AFTER]

interface FootLink {
  href: string
  label: string
  /** Rendered indented under the entry above it. */
  nested?: boolean
}

/** The footer's three link columns; the first column is the mark and the notice. */
const FOOT_COLUMNS: Array<[string, FootLink[]]> = [
  [
    'Documentation',
    [
      { href: '/docs', label: 'Quickstart' },
      { href: '/docs/reference/wallet', label: 'API reference' },
      { href: '/docs/examples', label: 'Examples', nested: true },
      { href: `https://www.npmjs.com/package/${SITE.npm}`, label: SITE.npm },
    ],
  ],
  [
    'For agents',
    [
      { href: '/llms.txt', label: 'llms.txt' },
      { href: '/AGENTS.md', label: 'AGENTS.md' },
    ],
  ],
  [
    'Project',
    [
      { href: '/use-cases', label: 'Use cases' },
      { href: '/status', label: 'Status' },
      { href: SITE.repo, label: 'GitHub' },
      { href: 'https://mmo.keicoin.org', label: 'World of Wonder' },
    ],
  ],
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
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#e9e6da">
<script>${THEME_BOOT}</script>
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/img/kei-coin-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site"><div class="wrap">
<a class="home" href="/"><img src="/img/kei-coin-64.png" alt="" width="26" height="26" decoding="async"><span>kei<b>coin</b>.org</span></a>
${NAV_BEFORE.map(([href, label]) => `<a href="${href}">${label}</a>`).join('\n')}
<span class="nav-group">${NAV_DOCS.map(([href, label]) => `<a href="${href}">${label}</a>`).join(
  '<span class="nav-sep" aria-hidden="true">/</span>',
)}</span>
${NAV_AFTER.map(([href, label]) => `<a href="${href}">${label}</a>`).join('\n')}
<a class="github-link" href="${SITE.repo}" target="_blank" rel="noopener noreferrer" aria-label="Kei on GitHub" title="Kei on GitHub">
<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
</a>
<button class="theme-toggle" type="button" aria-label="Change color theme" title="Change color theme">
<span class="theme-toggle-mark" aria-hidden="true"></span>
<span class="theme-toggle-label">Theme</span>
</button>
</div></header>
<main id="main">
${options.body}
</main>
<footer class="site"><div class="wrap">
<div class="foot-col">
<p class="foot-mark"><img src="/img/kei-coin-64.png" alt="" width="20" height="20" loading="lazy" decoding="async"><span>kei<b>coin</b>.org</span></p>
<p>${escapeHtml(SITE.tagline)}</p>
<p><strong>keicoin.org is the only domain this project uses.</strong> Anything else claiming to be Kei is not.</p>
<p>MIT</p>
</div>
${FOOT_COLUMNS.map(
  ([heading, links]) => `<div class="foot-col">
<h4>${escapeHtml(heading)}</h4>
<ul>${links
    .map(
      (link) =>
        `<li${link.nested ? ' class="foot-sub"' : ''}><a href="${link.href}">${escapeHtml(link.label)}</a></li>`,
    )
    .join('')}</ul>
</div>`,
).join('\n')}
</div></footer>
<script>${THEME_SCRIPT}${options.script ? `;\n${options.script}` : ''}</script>
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
      // `inline` rather than `escapeHtml`: the status line names packages and a
      // node URL, and rendering their backticks literally was leaving stray
      // punctuation on every page on the site.
      `<p class="status-line"><b>Status: ${escapeHtml(SITE.milestone)}.</b> ${inline(SITE.status)}</p>`,
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
