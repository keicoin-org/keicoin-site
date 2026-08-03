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
 *
 * Below the hero the page is a stack of claims, each with its evidence beside
 * it behind a hairline — the emblem, the swap table, the two code paths, the
 * admissions. Nothing is asserted in an empty column.
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

/** The terse scan-line under a claim, for the reader who is looking for a word. */
function traits(items: string[]): string {
  return `<ul class="traits">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
}

function jump(href: string, label: string): string {
  return `<a class="jump" href="${href}">${escapeHtml(label)} →</a>`
}

/** The head row every evidence panel wears. */
function panelHead(cells: string[]): string {
  return `<div class="panel-head">${cells.map((cell) => `<span>${escapeHtml(cell)}</span>`).join('')}</div>`
}

/**
 * The install picker. One command, four package managers — clicking a tab
 * swaps which command is shown, clicking copy copies it. No copy happens on
 * tab-switch, so tabbing through to read the alternatives never surprises
 * the clipboard.
 *
 * There are two of these on the page, one in the hero and one at the foot, so
 * this wires every instance rather than the first one it finds.
 */
const INSTALL_SCRIPT = `
(() => {
  document.querySelectorAll('.install').forEach((install) => {
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
  })
})()
`

/** Rendered twice — once in the hero, once at the foot — so it carries no ids. */
function installPicker(): string {
  const tab = (manager: string, command: string, active: boolean): string =>
    `<button type="button" class="install-tab${active ? ' active' : ''}" data-cmd="${escapeHtml(command)}" role="tab" aria-selected="${active}">${manager}</button>`

  return `<div class="install">
      <div class="install-tabs" role="tablist" aria-label="Package manager">
        ${tab('bun', `bun add ${SITE.npm}`, true)}
        ${tab('npm', `npm install ${SITE.npm}`, false)}
        ${tab('pnpm', `pnpm add ${SITE.npm}`, false)}
        ${tab('yarn', `yarn add ${SITE.npm}`, false)}
      </div>
      <div class="install-cmd">
        <code class="install-text">bun add ${escapeHtml(SITE.npm)}</code>
        <button type="button" class="install-copy" aria-label="Copy install command to clipboard">
          <span class="install-copy-label">Copy</span>
          <span class="install-copied" aria-hidden="true">Copied</span>
        </button>
      </div>
      <a class="install-link" href="/docs">Read the docs →</a>
    </div>`
}

/**
 * The strip under the hero. A SaaS page puts customer logos here; this project
 * does not have any, and the honest equivalent is the handful of facts that
 * decide whether a reader should keep going.
 */
const FACTS: Array<[string, string]> = [
  ['Fees', 'none'],
  ['Signup', 'none'],
  ['Smart-contract VM', 'none, by design'],
  ['Network', 'public testnet'],
  ['Value', 'nothing holds any'],
  ['Licence', 'MIT'],
]

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
    ${installPicker()}
  </div>

  ${pressPanel()}
</div></section>

<section class="facts"><div class="wrap">
  <p class="facts-label">Before you scroll</p>
  <ul class="facts-list">
    ${FACTS.map(([term, value]) => `<li><b>${escapeHtml(term)}</b> · ${escapeHtml(value)}</li>`).join('\n    ')}
  </ul>
</div></section>

<section class="statement"><div class="wrap">
  <p>The owl <mark>keeps pushing.</mark> Kei makes the ledger <mark>remember how far it got.</mark></p>
</div></section>

<section class="origin"><div class="wrap split">
  <div class="split-copy">
    <p class="eyebrow">Why Kei</p>
    <h2>The boulder is the point.</h2>
    <p>
      <strong>Kei means boulder in Latin.</strong> The coin shows an owl driving
      it uphill — our version of Sisyphus, except the work is not a punishment.
      It is the work of making a world persist.
    </p>
    <p>
      Game design is a behemoth of a task. State, ownership, settlement,
      recovery, exploits, and the promise that what a player earned will still
      be there tomorrow all have to move uphill together. A restart should not
      send the whole thing rolling back down.
    </p>
  </div>

  <div class="split-evidence">
    <figure class="origin-coin panel">
      ${panelHead(['Emblem', 'Unus Kei', 'Owl and boulder'])}
      <img src="/img/kei-coin-512.png" alt="${escapeHtml(COIN_ALT)}" width="512" height="512" loading="lazy" decoding="async">
    </figure>
  </div>
</div></section>

<section><div class="wrap split">
  <div class="split-copy">
    <p class="eyebrow">What it replaces</p>
    <h2>The auction house is the product.</h2>
    <p>
      Every game with an economy eventually needs listings, bids, settlement,
      price history, anti-fraud, and a database with a server in front of it. It
      is weeks of work, it is the part most likely to be exploited, and it is
      the part a small team cannot build safely.
    </p>
    <p>
      A card processor cannot take a $0.001 payment, because the fee exceeds the
      payment. A feeless chain can — and that single fact is why the rest of
      this is possible.
    </p>
    ${traits([
      'Feeless transfers',
      'No balances table',
      'Offer-locked escrow',
      'Atomic settlement',
      'History on the chain',
      'No payment processor',
    ])}
    ${jump('/use-cases', 'See what people ask for')}
  </div>

  <div class="split-evidence">
    <div class="scroll"><table class="spec">
      <thead><tr><th>Component</th><th>What you build today</th><th>On Kei</th></tr></thead>
      <tbody>
        <tr><th scope="row">Balances</th><td>A table, a service, and a permanent worry about rollbacks</td><td>consensus</td></tr>
        <tr><th scope="row">Ownership</th><td>An inventory table plus the index that makes it queryable</td><td>balanceOf</td></tr>
        <tr><th scope="row">Escrow</th><td>You hold the item, so you are now a custodian</td><td>the offer locks it</td></tr>
        <tr><th scope="row">Settlement</th><td>A transaction you have to get exactly right, every time</td><td>atomic, or nothing</td></tr>
        <tr><th scope="row">Price history</th><td>An events table and a reporting job</td><td>read the chain</td></tr>
        <tr><th scope="row">Payments</th><td>A processor, a floor of about fifty cents, and a compliance surface</td><td>free, and no floor</td></tr>
      </tbody>
    </table></div>
  </div>
</div></section>

<section><div class="wrap split">
  <div class="split-copy">
    <p class="eyebrow">The whole shape of it</p>
    <h2>Two entry points, and only two.</h2>
    <p>
      A key signs only for its own account, so a purchase is always two signed
      transactions. There is no <code>charge(someoneElse, …)</code>, and there
      never will be — it cannot exist. Any API implying otherwise is a bug.
    </p>
    ${traits([
      'Player key in the browser',
      'Issuer key on the server',
      'Two signed transactions',
      'No charge-on-behalf call',
    ])}
    ${jump('/docs', 'Read the integration guide')}
  </div>

  <div class="split-evidence">
    <div class="panes">
      ${code('Player — browser', PLAYER_SNIPPET)}
      ${code('Issuer — server only', ISSUER_SNIPPET)}
    </div>
  </div>
</div></section>

<section><div class="wrap split">
  <div class="split-copy">
    <p class="eyebrow">Use cases</p>
    <h2>Find the one you were actually asked for.</h2>
    <p>
      Each of these answers the request in the words it usually arrives in, with
      the API that satisfies it and the part that does not work yet named.
    </p>
    ${jump('/use-cases', 'All use cases')}
  </div>

  <div class="split-evidence">
    <div class="jobs">
      ${USE_CASES.map(
        (useCase) => `<a href="${useCase.path}">
        <span class="ask"><q>${escapeHtml(useCase.asks[0] ?? useCase.label)}</q></span>
        <span class="what">${inline(useCase.claim)}</span>
        <span class="arrow">→</span>
      </a>`,
      ).join('\n')}
    </div>
  </div>
</div></section>

<section><div class="wrap split">
  <div class="split-copy">
    <p class="eyebrow">Read this before you commit to anything</p>
    <h2>Where this actually is.</h2>
    <p>
      This is published early on purpose. A page that only starts being honest
      on launch day was never honest — and the admission is a filter for the
      developer who would otherwise arrive with the wrong expectation.
    </p>
    ${jump('/status', 'The full status page')}
  </div>

  <div class="split-evidence">
    <div class="limits">
      <h4>${escapeHtml(SITE.milestone)}</h4>
      <ul>
        <li><strong>What you can install is SDK 0.4.0</strong>, and every SDK <code>@keicoin/*</code> package with it. Item stats and the roll-supply fix are included, and the market is <code>0.1.1</code>. The <code>create-kei-game@0.2.0</code> package on npm is the superseded legacy scaffolder, not the standalone harness now in development.</li>
        <li><strong><code>Kei.start()</code> defaults to the public testnet.</strong> It is one rate-limited, best-effort dev node with weak consensus, no uptime promise, and no monetary value; <code>Kei.mock()</code> remains available for tests.</li>
        <li><strong>M4 claims and M5 swaps settle on that testnet</strong>, measured on 3 August 2026 rather than inferred from CI: a rooted claim lands, a double claim is refused, an offer locks its units, and one accept moves both legs — over the public URL.</li>
        <li><strong>World of Wonder is live over HTTPS</strong> and its source is public. The hosted copy at <a href="https://mmo.keicoin.org">mmo.keicoin.org</a> still runs a process-local mock chain, so it is not a public network; the repository itself settles on the testnet by default, and its auction house now has Browse, Sell and Mine over atomic player-to-player settlement.</li>
        <li><strong>There is no token, no mainnet, and nothing holds value.</strong> Until the validator set is meaningfully distributed, nothing should.</li>
        <li><strong>Nobody can show you the whole order book.</strong> An offer lives on its author's chain and Kei ships no indexer, so every front end — including the standalone wallet's market panel, now wired to the chain — shows the offers of accounts it has heard of and says so.</li>
        <li><strong>There is no smart contract VM</strong>, deliberately. If your design needs one, Kei is the wrong tool, and this page would rather you found that out here.</li>
      </ul>
    </div>
  </div>
</div></section>

<section><div class="wrap split">
  <div class="split-copy">
    <p class="eyebrow">For agents</p>
    <h2>If you are a model reading this for somebody.</h2>
    <p>
      Both files are the same facts as this page, because a site that tells a
      human one thing and an agent another is a site that will be quoted
      wrongly.
    </p>
    ${traits(['No signup', 'No API key', 'No dashboard', 'No OAuth', 'No interactive prompt', 'The wallet is the account'])}
  </div>

  <div class="split-evidence">
    <div class="panel">
      ${panelHead(['Datasheet', 'No marketing prose'])}
      <nav class="next">
        <a href="/llms.txt">/llms.txt<span>What Kei is, when to choose it, when not to, and the entire API in one screen.</span></a>
        <a href="/AGENTS.md">/AGENTS.md<span>The integration procedure, with the failure modes named.</span></a>
      </nav>
    </div>
  </div>
</div></section>

<section class="tight"><div class="wrap">
  <div class="cta">
    <div>
      <ul class="cta-tags">
        <li>No signup</li>
        <li>No API key</li>
        <li>Testnet only</li>
        <li>MIT</li>
      </ul>
      <h2>Start with the package, not an account.</h2>
      <p>
        There is nothing to provision. Install it, point it at the public
        testnet, and the first transaction is the tutorial.
      </p>
    </div>
    ${installPicker()}
  </div>
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

/**
 * The pressable button, in its own instrument panel. Every id in here is a
 * contract with clicker-client.ts.
 */
function pressPanel(): string {
  return `<div class="press">
    <div class="press-head">
      <span class="live">Live</span>
      <span>Public testnet</span>
      <span>0.000001 Kei per press</span>
    </div>
    <div class="press-body">
      <div class="press-readout" aria-hidden="true">
        <div class="press-count">
          <b id="press-count">0</b>
          <span id="press-count-unit">click credits</span>
        </div>
        <dl class="press-split" id="press-split">
          <div class="press-split-term">
            <dt>Available</dt>
            <dd id="press-available">0</dd>
          </div>
          <div class="press-split-term pending">
            <dt>Pending</dt>
            <dd id="press-pending">0</dd>
          </div>
        </dl>
      </div>
      <p class="press-announce" id="press-credit-status" role="status" aria-live="polite">0 click credits, 0 available.</p>
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
    </div>
    <p id="press-local-status" class="press-local-status">Each manual press sends 0.000001 testnet-only Kei to the null account. Only available credits can be spent in the workshop; pending ones are still with the testnet.</p>
    <script type="module" src="/clicker.js"></script>
  </div>`
}

export const HOME_SUMMARY = SITE.tagline
