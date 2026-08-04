import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'en-US',
  title: 'Kei documentation',
  titleTemplate: ':title — Kei documentation',
  description: 'Install, integrate, and use the Kei TypeScript SDK for game currencies and items.',
  base: '/docs/',
  outDir: '../dist/docs',
  cleanUrls: true,
  // Dark first, like keicoin.org, rather than whatever the OS prefers: the
  // visual system is built around an olive black, and the toggle stays for
  // anyone who wants paper.
  appearance: 'dark',
  lastUpdated: true,
  sitemap: {
    hostname: 'https://keicoin.org/docs/',
  },
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico', sizes: 'any' }],
    ['meta', { name: 'color-scheme', content: 'light dark' }],
    ['meta', { name: 'theme-color', content: '#e9e6da', media: '(prefers-color-scheme: light)' }],
    ['meta', { name: 'theme-color', content: '#0a0b09', media: '(prefers-color-scheme: dark)' }],
  ],
  markdown: {
    lineNumbers: true,
  },
  vite: {
    resolve: {
      // Vite normalizes resolved module paths through fs.realpathSync,
      // which corrects filesystem casing (e.g. C:/Users/... on Windows)
      // even when the process cwd was reached via a differently-cased
      // path (e.g. C:/users/...). VitePress's own resolvePageImports()
      // does *not* realpath in that case (see vuejs/vitepress#2779), so
      // the two disagree on a page's module id and rendering throws
      // "Cannot read properties of undefined (reading 'imports')".
      // Disabling realpath resolution on both sides keeps them in sync
      // regardless of invocation casing.
      preserveSymlinks: true,
    },
  },
  themeConfig: {
    siteTitle: 'Kei / documentation',
    nav: [
      { text: 'Quickstart', link: '/' },
      { text: 'API reference', link: '/reference/wallet' },
      { text: 'Examples', link: '/examples/' },
      { text: 'Project status', link: 'https://keicoin.org/status' },
      { text: 'keicoin.org', link: 'https://keicoin.org' },
    ],
    sidebar: [
      {
        text: 'Start here',
        items: [
          { text: 'Quickstart', link: '/' },
          { text: 'Integration model', link: '/guide/integration' },
          { text: 'Security rules', link: '/guide/security' },
        ],
      },
      {
        text: 'API reference',
        items: [
          { text: 'Wallet', link: '/reference/wallet' },
          { text: 'Tokens', link: '/reference/tokens' },
          { text: 'Items', link: '/reference/items' },
          { text: 'Batch rewards', link: '/reference/claims' },
          { text: 'Loot tables', link: '/reference/drops' },
          { text: 'Player shop', link: '/reference/shop' },
          { text: 'Errors', link: '/reference/errors' },
        ],
      },
      {
        text: 'Examples',
        items: [
          // `/examples/` with the trailing slash: the directory index, not
          // `/examples`, which `cleanUrls` would resolve to a page of that name.
          { text: 'Overview', link: '/examples/' },
          {
            text: 'Button',
            link: '/examples/button',
            items: [
              { text: 'Fundamentals', link: '/examples/button/fundamentals' },
              { text: 'NPC shop', link: '/examples/button/npc-shop' },
              { text: 'Player rewards', link: '/examples/button/player-rewards' },
            ],
          },
          {
            text: 'Carpet Markets',
            link: '/examples/carpet-markets',
            items: [
              { text: 'Market API', link: '/examples/carpet-markets/api' },
              { text: 'Offer lifecycle', link: '/examples/carpet-markets/offer-lifecycle' },
              { text: 'Future pool design (proposal)', link: '/examples/carpet-markets/future-pool-design' },
            ],
          },
          {
            text: 'World of Wonder',
            link: '/examples/world-of-wonder',
            // The page above is the overview; anything below it is one task done
            // end to end. A section with a `link` of its own stays clickable
            // rather than becoming a heading that only expands.
            items: [
              { text: 'Auction house integration', link: '/examples/world-of-wonder/auction-house' },
              { text: 'Loot and drops', link: '/examples/world-of-wonder/loot-and-drops' },
            ],
          },
        ],
      },
      {
        text: 'Project direction',
        items: [
          // Generated from docs/future/spec-sheet.yaml by `bun run spec:write`;
          // the YAML is canonical and spec-sheet.test.ts fails on drift.
          { text: 'Future spec sheet', link: '/future/spec-sheet' },
        ],
      },
    ],
    search: {
      provider: 'local',
      options: {
        detailedView: true,
      },
    },
    outline: {
      level: [2, 3],
      label: 'On this page',
    },
    editLink: {
      // `master`, not `main` — this repository's default branch. The wrong one
      // here is a 404 on every page of the docs.
      pattern: 'https://github.com/keicoin-org/keicoin-site/edit/master/docs/:path',
      text: 'Edit this page on GitHub',
    },
    lastUpdated: {
      text: 'Last updated',
      formatOptions: {
        dateStyle: 'medium',
      },
    },
    docFooter: {
      prev: 'Previous',
      next: 'Next',
    },
    socialLinks: [
      // The organisation. A reader following this wants the project, not the
      // repository that renders the page they are standing on.
      { icon: 'github', link: 'https://github.com/keicoin-org' },
    ],
    footer: {
      message: 'The package is the source of truth for the API.',
      copyright: 'MIT licensed.',
    },
  },
})
