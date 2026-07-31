import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'en-US',
  title: 'Kei documentation',
  titleTemplate: ':title — Kei documentation',
  description: 'Install, integrate, and use the Kei TypeScript SDK for game currencies and items.',
  base: '/docs/',
  outDir: '../dist/docs',
  cleanUrls: true,
  appearance: false,
  lastUpdated: true,
  sitemap: {
    hostname: 'https://keicoin.org/docs/',
  },
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico', sizes: 'any' }],
    ['meta', { name: 'theme-color', content: '#e9e6da' }],
  ],
  markdown: {
    lineNumbers: true,
  },
  themeConfig: {
    siteTitle: 'Kei / documentation',
    nav: [
      { text: 'Quickstart', link: '/' },
      { text: 'API reference', link: '/reference/wallet' },
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
          { text: 'Errors', link: '/reference/errors' },
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
      pattern: 'https://github.com/keicoin-org/keicoin-site/edit/main/docs/:path',
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
      { icon: 'github', link: 'https://github.com/keicoin-org/keicoin-site' },
    ],
    footer: {
      message: 'The package is the source of truth for the API.',
      copyright: 'MIT licensed.',
    },
  },
})
