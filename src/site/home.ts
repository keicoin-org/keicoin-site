/**
 * The landing page.
 *
 * The hero is the button. Not a picture of it, not a video of it — the actual
 * object from the demo, pressable, counting up. The product is "a real economy
 * in a browser game with no backend", and the fastest way to say that is to make
 * the first thing on the page a game object that responds.
 *
 * It is also the one piece of this site that could not be a template: a template
 * does not have a button on a pole in it.
 */

import { USE_CASES, ISSUER_SNIPPET, PLAYER_SNIPPET } from './content.js'
import { UPGRADES } from './clicker-state.js'
import { COIN_ALT, SITE, escapeHtml, inline, shell } from './layout.js'

/** Same three forms as everywhere else, plus the code panes. */
function code(caption: string, source: string): string {
  const highlighted = escapeHtml(source.trim())
    .replace(/(&#39;|')([^'\n]*)\1/g, '<span class="s">$&</span>')
    .replace(/\b(const|await|async|import|from|function|return|new|if|export)\b/g, '<span class="k">$1</span>')
    .replace(/(^|\n)(\s*\/\/[^\n]*)/g, '$1<span class="c">$2</span>')
  return `<figure class="code"><figcaption>${escapeHtml(caption)}</figcaption><pre><code>${highlighted}</code></pre></figure>`
}

/**
 * The install picker. One command, four package managers — clicking a tab
 * swaps which command is shown, clicking copy copies it. No copy happens on
 * tab-switch, so tabbing through to read the alternatives never surprises
 * the clipboard.
 */
const INSTALL_SCRIPT = `
(() => {
  const install = document.querySelector('.install')
  if (!install) return
  const tabs = install.querySelectorAll('.install-tab')
  const copyBtn = install.querySelector('.install-copy')
  const text = install.querySelector('.install-text')
  if (!copyBtn || !text) return

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('active')
        t.setAttribute('aria-selected', 'false')
      })
      tab.classList.add('active')
      tab.setAttribute('aria-selected', 'true')
      text.textContent = tab.dataset.cmd || text.textContent
    })
  })

  let copiedTimer
  copyBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(text.textContent || '')
    copyBtn.classList.add('copied')
    clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => copyBtn.classList.remove('copied'), 1300)
  })
})()
`

export function homePage(): string {
  const body = `
<section class="hero"><div class="wrap">
  <div>
    <h1>Your game's economy, <em>on a chain</em>, in one install.</h1>
    <p class="sub">
      Currencies and items that <b>outlive your server</b>, with no payment
      infrastructure, no balances table, and no signup. Sub-cent payments work,
      because transactions are free.
    </p>
    <div class="install">
      <div class="install-tabs" role="tablist" aria-label="Package manager">
        <button type="button" class="install-tab active" data-cmd="bun add ${SITE.npm}" role="tab" aria-selected="true">bun</button>
        <button type="button" class="install-tab" data-cmd="npm install ${SITE.npm}" role="tab" aria-selected="false">npm</button>
        <button type="button" class="install-tab" data-cmd="pnpm add ${SITE.npm}" role="tab" aria-selected="false">pnpm</button>
        <button type="button" class="install-tab" data-cmd="yarn add ${SITE.npm}" role="tab" aria-selected="false">yarn</button>
      </div>
      <div class="install-cmd">
        <code class="install-text">bun add ${escapeHtml(SITE.npm)}</code>
        <button type="button" class="install-copy" aria-label="Copy install command to clipboard">
          <span class="install-copy-label">Copy</span>
          <span class="install-copied" aria-hidden="true">Copied</span>
        </button>
      </div>
      <a class="install-link" href="/docs">Read the docs →</a>
    </div>
  </div>

  <div class="press">
    <div class="press-count" aria-live="polite">
      <b id="press-count">0</b>
      <span id="press-count-unit">click credits</span>
    </div>
    <p id="press-network-status" class="press-network-status" role="status" aria-live="polite">Press to connect to the public testnet.</p>
    <div class="press-stage">
      <div class="press-rig" id="press-rig">
        <button class="press-cap" id="press-cap" type="button" aria-label="Write one click to the Kei public testnet" aria-describedby="press-network-status press-local-status">
          <img
            class="press-img press-img-unpressed"
            id="press-image"
            src="/img/button-unpressed.webp"
            data-unpressed="/img/button-unpressed.webp"
            data-pressed="/img/button-pressed.webp"
            alt=""
            width="640"
            height="640"
            draggable="false"
          >
          <img
            class="press-img press-img-pressed"
            src="/img/button-pressed.webp"
            alt=""
            width="640"
            height="640"
            draggable="false"
            aria-hidden="true"
          >
        </button>
      </div>
      <aside class="press-shop" id="press-shop" aria-label="Local clicker upgrades" aria-hidden="true" inert>
        <div class="press-shop-heading"><span>Workshop</span><b>local</b></div>
        ${UPGRADES.map((upgrade) => `<div class="shop-item">
          <div><strong>${escapeHtml(upgrade.name)}</strong><span>${escapeHtml(upgrade.note)}</span></div>
          <button type="button" data-upgrade="${escapeHtml(upgrade.id)}">Buy · ${upgrade.cost}</button>
        </div>`).join('')}
      </aside>
    </div>
    <p id="press-local-status" class="press-local-status">Each manual press sends 0.000001 testnet-only Kei to the null account. Shop credits and upgrades stay in this browser.</p>
    <script type="module" src="/clicker.js"></script>
  </div>
</div></section>

<section class="origin"><div class="wrap">
  <figure class="origin-coin">
    <img src="/img/kei-coin-512.png" alt="${escapeHtml(COIN_ALT)}" width="512" height="512" loading="lazy" decoding="async">
    <figcaption>The Kei emblem / owl and boulder</figcaption>
  </figure>
  <div class="origin-copy">
    <p class="eyebrow">Why Kei</p>
    <h2>The boulder is the point.</h2>
    <p class="origin-lede">
      <strong>Kei means boulder in Latin.</strong> The coin shows an owl
      driving it uphill — our version of Sisyphus, except the work is not a
      punishment. It is the work of making a world persist.
    </p>
    <p>
      Game design is a behemoth of a task. State, ownership, settlement,
      recovery, exploits, and the promise that what a player earned will still
      be there tomorrow all have to move uphill together. A restart should not
      send the whole thing rolling back down.
    </p>
    <blockquote>The owl keeps pushing. Kei makes the ledger remember how far it got.</blockquote>
  </div>
</div></section>

<section><div class="wrap">
  <p class="eyebrow">What it replaces</p>
  <h2>The auction house is the product. Micropayments are the demo.</h2>
  <p class="dim">
    Every game with an economy eventually needs listings, bids, settlement, price
    history, anti-fraud, and a database with a server in front of it. It is weeks
    of work, it is the part most likely to be exploited, and it is the part a
    small team cannot build safely.
  </p>

  <div class="scroll"><table class="swap-table">
    <thead><tr><th>Component</th><th>What you build today</th><th>On Kei</th></tr></thead>
    <tbody>
      <tr><td>Balances</td><td>A table, a service, and a permanent worry about rollbacks</td><td>consensus</td></tr>
      <tr><td>Ownership</td><td>An inventory table plus the index that makes it queryable</td><td>balanceOf</td></tr>
      <tr><td>Escrow</td><td>You hold the item, so you are now a custodian</td><td>the offer locks it</td></tr>
      <tr><td>Settlement</td><td>A transaction you have to get exactly right, every time</td><td>atomic, or nothing</td></tr>
      <tr><td>Price history</td><td>An events table and a reporting job</td><td>read the chain</td></tr>
      <tr><td>Payments</td><td>A processor, a floor of about fifty cents, and a compliance surface</td><td>free, and no floor</td></tr>
    </tbody>
  </table></div>
  <p class="dim">A card processor cannot take a $0.001 payment, because the fee exceeds the payment. A feeless chain can — and that single fact is why the rest of this is possible.</p>
</div></section>

<section><div class="wrap">
  <p class="eyebrow">The whole shape of it</p>
  <h2>Two entry points, because a key signs only for its own account.</h2>
  <p class="dim">
    A purchase is always two signed transactions. There is no
    <code>charge(someoneElse, …)</code>, and there never will be — it cannot
    exist. Any API implying otherwise is a bug.
  </p>
  <div class="panes">
    ${code('Player — browser', PLAYER_SNIPPET)}
    ${code('Issuer — server only', ISSUER_SNIPPET)}
  </div>
</div></section>

<section><div class="wrap">
  <p class="eyebrow">Use cases</p>
  <h2>Find the one you were actually asked for.</h2>
  <div class="jobs">
    ${USE_CASES.map(
      (useCase) => `<a href="${useCase.path}">
      <span class="ask"><q>${escapeHtml(useCase.asks[0] ?? useCase.label)}</q>
      <span class="what">${inline(useCase.claim)}</span></span>
      <span class="arrow">→</span>
    </a>`,
    ).join('\n')}
  </div>
</div></section>

<section class="tight"><div class="wrap narrow">
  <p class="eyebrow">Read this before you commit to anything</p>
  <h2>Where this actually is.</h2>
  <div class="limits">
    <h4>Public M3 testnet; native M4 claims merged</h4>
    <ul>
      <li><strong>The SDK packages are published at 0.3.0</strong> and run end to end, with TypeScript types. That includes the market and the in-game wallet panel.</li>
      <li><strong><code>Kei.start()</code> defaults to the public testnet.</strong> It is one rate-limited, best-effort dev node with weak consensus, no uptime promise, and no monetary value; <code>Kei.mock()</code> remains available for tests.</li>
      <li><strong>Native M4 claims are merged and CI-gated.</strong> The node runs the pinned SDK M2 and M4 contracts against a clean startup. This page does not yet claim the public endpoint has been redeployed with M4.</li>
      <li><strong>World of Wonder is live over HTTPS</strong> and its source is public. The hosted copy at <a href="https://mmo.keicoin.org">mmo.keicoin.org</a> still runs a process-local mock chain, so it is not a public network; the repository itself settles on the testnet by default.</li>
      <li><strong>There is no token, no mainnet, and nothing holds value.</strong> Until the validator set is meaningfully distributed, nothing should.</li>
      <li><strong>The market and both wallets are merged and published</strong> — <code>@keicoin/market</code>, the in-game panel in <code>kei-transaction</code>, and the standalone wallet in its own repository. No public node deployment carrying the native swap blocks is claimed here, and the standalone wallet's market panel is not wired up yet.</li>
      <li><strong>There is no smart contract VM</strong>, deliberately. If your design needs one, Kei is the wrong tool, and this page would rather you found that out here.</li>
    </ul>
  </div>
  <p class="dim">
    This is published early on purpose. A page that only starts being honest on
    launch day was never honest — and the admission is a filter for the developer
    who would otherwise arrive with the wrong expectation.
    <a href="/status">The full status page</a> keeps score.
  </p>
</div></section>

<section class="tight"><div class="wrap narrow">
  <p class="eyebrow">For agents</p>
  <h2>If you are a model reading this on somebody's behalf.</h2>
  <p class="dim">
    The datasheet is <a href="/llms.txt">/llms.txt</a> — what Kei is, when to
    choose it, when not to, and the entire API in one screen, with no marketing
    prose. <a href="/AGENTS.md">/AGENTS.md</a> is the integration procedure with
    the failure modes named. Both are the same facts as this page, because a site
    that tells a human one thing and an agent another is a site that will be
    quoted wrongly.
  </p>
  <p class="dim">
    No signup, no API key, no dashboard, no OAuth, and no interactive prompt
    anywhere. The wallet is the account: a seed is a credential and a funded
    address is a provisioned account.
  </p>
</div></section>
`

  return shell({
    path: '/',
    title: 'Kei — real currencies and items for browser games',
    description:
      'A feeless chain with native tokens and an SDK that lets a game developer add real currencies, items, loot drops and a player market to a browser game without running payment infrastructure or a database.',
    asks: USE_CASES.flatMap((useCase) => useCase.asks),
    body,
    script: INSTALL_SCRIPT,
  })
}

export const HOME_SUMMARY = SITE.tagline
