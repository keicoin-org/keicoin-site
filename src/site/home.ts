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
 * The hero button's behaviour. Deliberately honest: it counts locally and says
 * so, because the alternative — quietly implying this page is on a chain — is
 * exactly the kind of overstatement §12 warns about.
 *
 * The button itself is the real asset from the demo, swapped between its two
 * photographed states rather than redrawn in CSS.
 */
const PRESS_SCRIPT = `
(() => {
  const bindPressButton = () => {
    const cap = document.querySelector('.press-cap')
    const rig = document.querySelector('.press-rig')
    const img = document.querySelector('.press-img')
    const count = document.querySelector('#press-count')
    if (!cap || !rig || !img || !count) return

    cap._pressController?.abort()
    const controller = new AbortController()
    cap._pressController = controller
    const listener = { signal: controller.signal }

    new Image().src = img.dataset.pressed

    const setHeld = (held) => {
      cap.classList.toggle('down', held)
      img.src = held ? img.dataset.pressed : img.dataset.unpressed
    }

    setHeld(false)

    cap.addEventListener('pointerdown', (e) => {
      if (cap.setPointerCapture) cap.setPointerCapture(e.pointerId)
      setHeld(true)
    }, listener)
    cap.addEventListener('pointerup', () => setHeld(false), listener)
    cap.addEventListener('pointercancel', () => setHeld(false), listener)
    cap.addEventListener('lostpointercapture', () => setHeld(false), listener)
    cap.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') setHeld(true)
    }, listener)
    cap.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Enter') setHeld(false)
    }, listener)

    cap.addEventListener('contextmenu', (e) => e.preventDefault(), listener)
    cap.addEventListener('dragstart', (e) => e.preventDefault(), listener)

    let pressed = Number(count.textContent) || 0
    cap.addEventListener('click', () => {
      count.textContent = String(++pressed)

      const pop = document.createElement('span')
      pop.className = 'pop'
      pop.textContent = '+1'
      pop.style.left = (44 + Math.random() * 12) + '%'
      rig.appendChild(pop)
      setTimeout(() => pop.remove(), 760)
    }, listener)
  }

  bindPressButton()
  window.addEventListener('pageshow', bindPressButton)
})()
`

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
    <div class="cta">
      <a class="button-link primary" href="/examples/button">Play the demo</a>
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
  </div>

  <div class="press">
    <div class="press-readout">
      <b id="press-count">0</b>
      <span>presses — this one is just a page</span>
    </div>
    <div class="press-rig">
      <button class="press-cap" type="button" aria-label="Press the button">
        <img
          class="press-img"
          src="/img/button-unpressed.webp"
          data-unpressed="/img/button-unpressed.webp"
          data-pressed="/img/button-pressed.webp"
          alt=""
          width="640"
          height="640"
          draggable="false"
        >
      </button>
    </div>
    <p class="press-hint">In the demo, every press is on-chain →</p>
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
    <h4>M1 complete, M2 acceptance in progress</h4>
    <ul>
      <li><strong>The SDK is published at 0.1.0</strong> and runs end to end, with TypeScript types.</li>
      <li><strong>The chain it talks to is an in-memory mock.</strong> It enforces the real ledger rules, so the API will not move when the node lands — but there is no network yet.</li>
      <li><strong>The node builds, starts, serves RPC, and executes its M2 ledger paths in CI.</strong> Until the exact SDK M2 suite is an enforced green node gate, M2 is not done.</li>
      <li><strong>The MMO prototype is live over HTTPS.</strong> It still uses a process-local mock chain and is not a public network.</li>
      <li><strong>There is no token, no mainnet, and nothing holds value.</strong> Until the validator set is meaningfully distributed, nothing should.</li>
      <li><strong>The market and the wallets are specified, not built.</strong></li>
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
    script: `${PRESS_SCRIPT};\n${INSTALL_SCRIPT}`,
  })
}

export const HOME_SUMMARY = SITE.tagline
