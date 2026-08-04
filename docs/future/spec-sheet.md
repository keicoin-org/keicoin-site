---
title: Future spec sheet
description: What is shipped, in progress, planned, blocked, and refused, per milestone and deliverable — rendered from the canonical spec-sheet.yaml.
---

<!--
  GENERATED FILE — do not edit by hand.
  Rendered deterministically from docs/future/spec-sheet.yaml by `bun run spec:write`;
  `bun run spec:check` and src/site/spec-sheet.test.ts fail on any drift between the two.
-->

# Kei future spec sheet

A feeless blockchain with native tokens, an SDK that lets a game developer add real currencies and items to a browser game without ever running payment infrastructure, and a creation harness that builds the game around them.

**Definition of v1.** One external developer ships a game on Kei (SPEC.md section 13 and section 14, criterion 10). No other measure substitutes for it.

**Authorship.** Claude Fable 5 (Fable-authored draft; evidence recorded 2026-08-03 and 2026-08-04 in the source documents).

::: info How to read this page
This page is rendered from [`docs/future/spec-sheet.yaml`](https://github.com/keicoin-org/keicoin-site/blob/master/docs/future/spec-sheet.yaml), the canonical machine-readable sheet (schema `kei-future-spec-sheet` `1.0.0`); nothing here claims more than that sheet's source documents record. Acceptance lines come in two kinds: **Verified** cites evidence already recorded in a source document, and **Closes when** states the measurable condition that would close the entry. A **blocked** entry names what it waits on, and a **non-goal** is refused on the record, not deferred.
:::

## Source documents

- **SPEC.md (repository root, kei umbrella checkout)** — The normative brief. Anything not in it is out of scope until it is in it.
- **README.md (repository root, kei umbrella checkout)** — The current verified baseline, measured against https://testnet.keicoin.org/rpc on 3 August 2026, and the four active tracks.
- **keicoin-site/README.md and keicoin-site/src/site/content.ts** — The site's live-correction rules and its /status source record.
- **carpet-markets/README.md** — The worked market demo's own statement of what it is and is not.

## Milestones at a glance

| Milestone | Horizon | Status | Deliverables |
| --- | --- | --- | --- |
| [Carpet Markets meets its nine written acceptance criteria](#ms-carpet-markets-criteria) | `near-term` | <Badge type="warning" text="in-progress" /> | 1 planned · 3 shipped |
| [Chain and public network: the node boring, the testnet honest](#ms-chain-and-network) | `near-term` | <Badge type="warning" text="in-progress" /> | 2 in-progress · 5 shipped |
| [Create Kei MMO: all nine one-shot criteria hold](#ms-create-kei-mmo-one-shot) | `near-term` | <Badge type="warning" text="in-progress" /> | 4 in-progress · 3 planned |
| [Economy DX: an economy described in a sentence, running](#ms-economy-dx) | `near-term` | <Badge type="warning" text="in-progress" /> | 1 in-progress · 2 planned · 3 shipped |
| [Mainnet readiness — explicitly not a build task](#ms-mainnet-readiness) | `post-v1` | <Badge type="danger" text="blocked" /> | 4 planned |
| [Reserve governance: the on-chain vote, designed from scratch](#ms-reserve-governance) | `post-v1` | <Badge type="info" text="planned" /> | 3 planned |
| [Surfaces: wallet, examples, and the site](#ms-surfaces) | `near-term` | <Badge type="warning" text="in-progress" /> | 1 blocked · 2 in-progress · 6 shipped |
| [v1: one external developer ships a game on Kei](#ms-v1-external-integration) | `v1` | <Badge type="info" text="planned" /> | 1 in-progress · 1 planned |

## Carpet Markets meets its nine written acceptance criteria {#ms-carpet-markets-criteria}

<Badge type="warning" text="in-progress" /> · horizon `near-term` · owner `carpet-markets` · repositories `carpet-markets`

The worked demo of @keicoin/market, a pump.fun-shaped launchpad on a no-value mock chain whose argument is that a coin's immutable transfer policy is the product. SPEC.md section 9.6 gives it nine criteria, each checkable from a clean clone. Six are closed with committed tests; three (first buy in five interactions, 360 px viewport, keyboard-only loop) were reported closed on a browser walk that was never committed, so nobody can re-run that evidence and they count as open.

**Depends on:** [`dl-node-swap-settlement`](#dl-node-swap-settlement), [`dl-sdk-umbrella-release`](#dl-sdk-umbrella-release).

**Acceptance**

- Closes when: all nine criteria of SPEC.md section 9.6 hold, each checkable in one step from a clean clone by somebody who has not read the spec.
- Verified: bun run check passes (typecheck, worker typecheck, and the ledger-asserted test suite), per carpet-markets/README.md.

**Risks**

- Criteria closed on evidence that is not committed rot silently; SPEC.md section 9.6 requires each criterion to be checkable from a clean clone, and an uncommitted browser walk fails that requirement even when the walk passed.
- The demo is read as a product or a roadmap; it is satire on a mock chain, defensible precisely because the coins are worthless, and it must never be described as production-ready or mainnet-ready.

### Committed browser walk closing criteria 1, 5, and 6 {#dl-carpet-browser-walk-criteria}

<Badge type="info" text="planned" /> · repositories `carpet-markets`

Criteria 1 (a first-time visitor with no wallet completes one buy in five interactions or fewer), 5 (no horizontal scroll at a 360 px viewport), and 6 (launch, sell, buy, cancel by keyboard alone with a visible focus ring) were reported closed on a headless browser walk that was never committed. There is no Playwright or equivalent in the repository, so the evidence cannot be re-run.

**Depends on:** [`dl-carpet-ledger-asserted-criteria`](#dl-carpet-ledger-asserted-criteria).

**Acceptance**

- Closes when: a browser walk asserting criteria 1, 5, and 6 is committed to the repository and passes from a clean clone.

### Criteria 2, 3, 4, 7, 8, and 9 closed with committed tests {#dl-carpet-ledger-asserted-criteria}

<Badge type="tip" text="shipped" /> · repositories `carpet-markets`

Refusing states named before the action (lib/refusals.ts), pending kept visually distinct from confirmed (lib/balance.ts carries confirmed, incoming, and in-flight separately to the screen), the explicit no-trades-yet rendering, the transfer-policy badge, ledger-level assertion of interface claims, and known holes stated on screen. The product-UX pass merged as carpet-markets PR #4 on 4 August 2026 and is deployed; it also fixed a real price-direction bug where a bid's coins-per-Kei price sorted the book upside down.

**Acceptance**

- Verified: the kei umbrella README.md records that of SPEC.md section 9.6's nine criteria only 1, 5, and 6 remain open, and that the rest have committed tests.
- Verified: test/refusals.test.ts, test/balance.test.ts, test/registry.test.ts, test/pricing.test.ts, test/tx.test.ts, test/board.test.ts, and test/social.test.ts run under bun run check, per carpet-markets/README.md.

### Mainnet refused by name before a socket opens {#dl-carpet-mainnet-refusal}

<Badge type="tip" text="shipped" /> · repositories `carpet-markets`

CARPET_NETWORK=mainnet throws before opening a socket and names the gates (SPEC.md sections 15.1, 15.2, 15.3, 17, and 9.6). The refusal is enforced rather than promised, and NETWORK.md, the /network page, and shared/network.ts carry the five mainnet gates, four of which are arguments rather than builds.

**Acceptance**

- Verified: the kei umbrella README.md records the enforced refusal, and test/network.test.ts pins the badge, the mainnet refusal, and the readiness verdict, per carpet-markets/README.md.

### The whole market path probed against the public testnet {#dl-carpet-testnet-probe}

<Badge type="tip" text="shipped" /> · repositories `carpet-markets`

bun run probe:testnet walks issue (with the issuance burn visible), mint, offer, accept, cancel, price history, and a policy refusal the ledger makes on its own, against the public node.

**Depends on:** [`dl-node-gateway-swap-reads`](#dl-node-gateway-swap-reads), [`dl-node-swap-settlement`](#dl-node-swap-settlement).

**Acceptance**

- Verified: bun run probe:testnet passes 13/13 against https://testnet.keicoin.org/rpc, per the kei umbrella README.md; NETWORK.md carries the last run with the node's own answers.

## Chain and public network: the node boring, the testnet honest {#ms-chain-and-network}

<Badge type="warning" text="in-progress" /> · horizon `near-term` · owner `kei-node` · repositories `kei-node`, `kei-transaction`

The Banano fork with native tokens, rooted claims, and swap settlement in consensus, plus the one public best-effort testnet node. The token, claim, and swap primitives are live and measured; what remains is the track's own condition — conformance suites passing against the live public node from a ledger that existed before the binary did, the case a fresh CI database never exercises.

**Acceptance**

- Closes when: the published conformance suites pass against the live public node, over the public URL, starting from a ledger that existed before the binary did (SPEC.md section 13).

**Risks**

- Ledger growth from mass claims is the binding constraint, not throughput; mitigations are pruning support, issuer-closed roots, and burn-on-consume (SPEC.md section 5.5).
- Migration regressions: the store-v24 incident showed a claims-or-swaps binary unable to open a ledger written by an earlier one, because new tables were added without a ledger version; CI only ever starts from a fresh database, which is the one case that always works.
- One rate-limited, best-effort public node with weak consensus, published dev keys, and no uptime promise; until the validator set is distributed, Kei is a testnet with real branding and no real value belongs on it (SPEC.md section 5.9).

### Gateway forwards the market's two read actions {#dl-node-gateway-swap-reads}

<Badge type="tip" text="shipped" /> · repositories `kei-node`

The public gateway forwards swap_info and account_swaps, the two read actions a market needs, so the whole market flow passes over the public URL rather than only against the node directly.

**Depends on:** [`dl-node-swap-settlement`](#dl-node-swap-settlement).

**Acceptance**

- Verified: the whole market flow over the public URL passes end to end, measured 3 August 2026, per the kei umbrella README.md and the site's /status record.

### A ledger version for every table added {#dl-node-ledger-migration-discipline}

<Badge type="warning" text="in-progress" /> · repositories `kei-node`

The migration discipline the store-v24 incident bought: every added table gets its own ledger version, so an upgraded binary can open a ledger written by its predecessor. The public node was rebuilt onto master on 3 August 2026 and reports store_version 24, accepting both claim and swap block types.

**Acceptance**

- Verified: the public node reports store_version 24 and accepts claim and swap block types, per the kei umbrella README.md.
- Closes when: an upgraded node binary opens and serves a ledger written by the previous release without a rebuild, demonstrated on the live public node rather than a fresh database.

### Conformance suites against the live public node {#dl-node-live-conformance}

<Badge type="warning" text="in-progress" /> · repositories `kei-node`, `kei-transaction`

The shared SDK conformance suite runs against the live node over the public URL rather than a fresh database, from a pinned revision so the node gate and the live check run the same contract. The track's full condition — a ledger that predates the binary — is not yet evidenced.

**Depends on:** [`dl-node-ledger-migration-discipline`](#dl-node-ledger-migration-discipline).

**Acceptance**

- Verified: bun run test:m3-live passes against https://testnet.keicoin.org/rpc from a clean clone of kei-transaction; the pinned run is 11 passes on the base surface, 2 on claims, 3 on the market, per the site's /status record.
- Closes when: the published conformance suites pass against the live public node from a ledger that already existed before the binary did.

### Rooted claims in consensus (commit, claim, commit_close) {#dl-node-rooted-claims}

<Badge type="tip" text="shipped" /> · repositories `kei-node`

One issuer block publishes a Merkle root; each player claims from their own chain in parallel; the node verifies proofs and rejects double-claims keyed (account, root); roots are closed by the issuer, not by a clock (SPEC.md section 5.5).

**Acceptance**

- Verified: on the live node, one issuer root, parallel player claims, correct balances, and a second claim from the same account refused, measured 3 August 2026 from a clean install, per the kei umbrella README.md.

### Atomic swap settlement in consensus (swap_offer, swap_accept, swap_cancel) {#dl-node-swap-settlement}

<Badge type="tip" text="shipped" /> · repositories `kei-node`

The linked swap pair of SPEC.md section 9.2: the offerer locks their own asset on their own chain, one accept moves both legs or neither, and the accept-versus-cancel race resolves through existing ORV fork resolution keyed on the consumed lock.

**Acceptance**

- Verified: on the live node, the lock is enforced by the ledger rather than the SDK, a double sale is refused, and one accept moves both legs, measured 3 August 2026, per the kei umbrella README.md.

### Native token primitive with protocol-enforced policy and the issuance burn {#dl-node-token-primitive}

<Badge type="tip" text="shipped" /> · repositories `kei-node`

issue, mint, burn, transfer, and balance enforced in block validation, with derived asset ids (idempotent issuance), immutable transfer policy, work tiers for anti-spam, consensus weight from Kei balances only, and the escalating per-account issuance burn — the one operation that is not free (SPEC.md sections 5.3 through 5.6).

**Acceptance**

- Verified: token.issue() works and is idempotent (re-issuing a symbol returns the same asset id), the issuance burn is protocol-enforced (the issuer's balance drops on its first asset), and mint() and balanceOf() work, measured 3 August 2026 against the public node, per the kei umbrella README.md.

### Work server as required v1 infrastructure {#dl-work-server}

<Badge type="tip" text="shipped" /> · repositories `kei-transaction`, `keicoin-site`

Client-side proof-of-work is otherwise a visible pause mid-game, so precomputed work is required v1 infrastructure, not an optimisation (SPEC.md section 5.5). @keicoin/work ships the work-server integration, and the site's Worker provides the same-origin work endpoint the homepage clicker uses.

**Acceptance**

- Verified: @keicoin/work is published at 0.4.1 and resolves from the kei-transaction@0.8.0 umbrella, per the npm registry; the site Worker's one route is the same-origin work endpoint, per keicoin-site/README.md.

## Create Kei MMO: all nine one-shot criteria hold {#ms-create-kei-mmo-one-shot}

<Badge type="warning" text="in-progress" /> · horizon `near-term` · owner `create-kei-game` · repositories `create-kei-game`

The opinionated 2D/3D MMORPG creation harness of SPEC.md section 11.3: four onboarding questions, no template question, the intent/capability/plan protocol, one TypeScript engine behind a versioned JSON-lines boundary, a Kei TUI and a first-class agent mode, and a generated project the developer owns outright. The work is an unpublished draft branch (PR #1, integration head b6edae7); the repository's default branch still carries the retired three-template scaffolder, and the create-kei-game@0.2.0 on npm is that retired scaffolder, not this product.

**Depends on:** [`dl-sdk-umbrella-release`](#dl-sdk-umbrella-release).

**Acceptance**

- Closes when: all nine one-shot criteria of SPEC.md section 11.3 hold — one non-interactive invocation, no edits, and the emitted project installs, builds, starts, shows two headless clients each other moving, survives a server restart, settles a player-to-player trade on Kei, states every deferral in its plan record, presents one release-quality 30-second core loop, and keeps passing after the harness is deleted.

**Risks**

- The harness quietly becomes a framework; the standing test is that deleting it from the machine must never break a generated game (SPEC.md section 16).
- A model-driven harness promises systems it does not have; the capability record is the only source of what a plan may promise, and naming a domain is never a claim it is built (SPEC.md section 11.3).
- A technically correct networked gray box passes every systems test and still fails the product; presentation is criterion 9, not backlog.

### Criterion 1: one invocation, exit 0, one machine-readable result {#dl-harness-agent-one-shot}

<Badge type="warning" text="in-progress" /> · repositories `create-kei-game`

Agent mode bypasses onboarding, never prompts, fails fast with machine-readable diagnostics, and refuses the retired --source and --template inputs with a stable error code. Today one bounded engine run executes against the first step of the plan — a real provider call, three workspace-scoped tools, at most 24 model round-trips and thirty minutes — and then stops; --plan-only emits the intent and plan records without writing.

**Acceptance**

- Verified: criterion 1 partly holds — it holds only for a run that stops after the first plan step, per SPEC.md section 11.3 and the kei umbrella README.md.
- Closes when: a single --agent --json invocation exits 0 with one machine-readable result after building the whole project, not only the first plan step.

### Criterion 7: every capability domain implemented or explicitly deferred {#dl-harness-capability-coverage}

<Badge type="warning" text="in-progress" /> · repositories `create-kei-game`

The intent, capability, and plan records exist and cross the JSON-lines boundary; planned and absent capabilities are recorded. The criterion is not met end to end because the one-turn result does not implement or defer every selected available domain.

**Depends on:** [`dl-harness-agent-one-shot`](#dl-harness-agent-one-shot).

**Acceptance**

- Closes when: diffing the intent record against the plan record shows every domain in SPEC.md section 11.3's capability table either implemented or present in plan.deferred naming its status, with nothing an intent asked for silently absent.

### Criterion 8: everything keeps passing after the harness is deleted {#dl-harness-deletion-survival}

<Badge type="warning" text="in-progress" /> · repositories `create-kei-game`

Structurally advanced, not met: the generated runtime has zero harness imports and runs from its own install, and a 3D scaffold's node kei-mmo/content/check.mjs passes with plain node, no dependencies, and the harness deleted — which is the criterion's shape, not proof of it, because criteria 2 through 7 and 9 must all pass after deletion and they do not all pass yet.

**Depends on:** [`dl-harness-capability-coverage`](#dl-harness-capability-coverage), [`dl-harness-generated-projects`](#dl-harness-generated-projects), [`dl-harness-presentation-loop`](#dl-harness-presentation-loop).

**Acceptance**

- Closes when: with the harness removed from the machine, criteria 2 through 7 and the presentation proof of criterion 9 all pass, re-run from the generated project and its copied assets.

### Criteria 2 through 6 for fresh blank 2D and 3D generated projects {#dl-harness-generated-projects}

<Badge type="warning" text="in-progress" /> · repositories `create-kei-game`

At unpublished draft integration head b6edae7, fresh blank 2D and Babylon.js 3D projects install and build with no edit; a loopback-only authoritative WebSocket server assigns identity; two generated headless clients observe one another move from server-authored snapshots; server-assigned identity, position, XP, and derived level survive clean restarts with forged state changing neither memory nor the versioned SQLite store; and a player-custodied economy proof issues GOLD, mints an item, and atomically settles a reserved player-to-player trade using published kei-transaction@0.6.0 while the game server holds no balance. This is construction-scale proof on an unpublished branch, not a published product, and it claims no account recovery, socket-to-wallet identity, scale, or public hosting.

**Depends on:** [`dl-sdk-umbrella-release`](#dl-sdk-umbrella-release).

**Acceptance**

- Verified: git checkout b6edae7 on the codex/m9-game-harness branch, bun install, and bun run test:generated run the clean 2D/3D smoke including restart-proof and economy:check, per the site's /status record.
- Closes when: criteria 2 through 6 hold for the project an ordinary one-shot invocation emits, from a published package rather than a draft branch checkout.

### Criterion 9: one presentable 30-second core loop {#dl-harness-presentation-loop}

<Badge type="info" text="planned" /> · repositories `create-kei-game`

One core loop with a coherent admitted art set, blended motion, animation-synchronised SFX, VFX, camera and UI feedback, and a declared post-processing tier inside its frame budget — no T-pose, gray box, missing asset, silent impact, or synth placeholder. The content-pipeline branch merged into the draft's own branch on 4 August 2026 adds versioned style selection, asset admission, motion readiness, audio intent, and deterministic cut-scene assembly, but its previs clips and synthesized cue voices are honest placeholders, not the polished motion and SFX this criterion requires.

**Depends on:** [`dl-harness-generated-projects`](#dl-harness-generated-projects).

**Acceptance**

- Closes when: the deterministic polish:check passes with captured video and audio, asserting asset admission, semantic animation and cue events, visual baselines, and the named device profile's frame budget, with human sign-off on the capture (SPEC.md section 11.3, criterion 9).

### Package published as create-kei-mmo, repository renamed {#dl-harness-publish}

<Badge type="info" text="planned" /> · repositories `create-kei-game`

No package is published under either name; npm still serves the retired create-kei-game@0.2.0 scaffolder, which is a different product, and the repository is still named create-kei-game pending the rename to match the product name Create Kei MMO.

**Depends on:** [`dl-harness-agent-one-shot`](#dl-harness-agent-one-shot).

**Acceptance**

- Closes when: the harness is published under the create-kei-mmo package name from a default branch that no longer carries the retired scaffolder.

### The Kei TUI over the JSON-lines boundary {#dl-harness-tui}

<Badge type="info" text="planned" /> · repositories `create-kei-game`

A standalone Rust TUI owning terminal rendering and input and nothing else, over the same versioned JSON-lines boundary as agent mode. No TUI exists today. The planned vendoring of the Apache-2.0 xai-ratatui-inline and xai-ratatui-textarea components must carry the NOTICE and third-party attribution their licence requires, with no upstream pager, shell, or product name shipping (SPEC.md section 11.3.1).

**Depends on:** [`dl-harness-agent-one-shot`](#dl-harness-agent-one-shot).

**Acceptance**

- Closes when: the interactive TUI and agent mode run the same engine over the same boundary with no behavioural difference, and the vendored components carry their required NOTICE and attribution.

## Economy DX: an economy described in a sentence, running {#ms-economy-dx}

<Badge type="warning" text="in-progress" /> · horizon `near-term` · owner `kei-transaction` · repositories `kei-transaction`

The current priority. The primitives ship and are measured; what is being closed is distance, not capability — economy-shaped surface over the existing primitives so the vocabulary matches what a game designer thinks in, errors that state their own fix, and the sixty-second path staying sixty seconds as the surface grows. Out of scope by construction: anything that needs neither consensus nor custody.

**Acceptance**

- Closes when: a developer who has never seen Kei describes a game economy in a sentence and has it running — currency, sink, item with stats, sale, resale — without reading the spec, without a database, and without operating anything; and an agent does the same from the shipped skills alone, with the sixty-second test still passing against the grown surface (SPEC.md section 13).

**Risks**

- Scope creep into a game backend; the consensus-or-custody test of SPEC.md section 4 is the guard, and no business justification overrides it.
- Overstated claims: an agent cannot detect overstatement or ask a follow-up, so any claim that outruns the evidence becomes a broken integration with a delay.

### Per-task skills, AGENTS.md, and llms.txt shipped in the package {#dl-sdk-agent-skills}

<Badge type="info" text="planned" /> · repositories `kei-transaction`

One skill per task (add a currency, sell an item from an NPC, accept a top-up, mint a reward), each with when to use it, the minimum working code, the common mistakes, and the errors it produces — documentation, not code, distributed in the package alongside AGENTS.md and llms.txt (SPEC.md sections 11.2 and 12). The site already serves its own machine surface; the in-package skills are the part not yet evidenced.

**Depends on:** [`dl-sdk-umbrella-release`](#dl-sdk-umbrella-release).

**Acceptance**

- Closes when: the published kei-transaction package contains the per-task skills, AGENTS.md, and llms.txt, and an agent completes a working integration from the shipped skills alone.

### Economy-shaped surface: recipes, drop tables, and the player shop {#dl-sdk-economy-surface}

<Badge type="tip" text="shipped" /> · repositories `kei-transaction`

@keicoin/economy 0.2.2 ships declarative recipes with a dry run before anything is signed, plus weighted loot-table drops bound into the same claim root as an ordinary reward — with the honest caveat that drops are not verifiable randomness, because the roll happens on the game's server. @keicoin/player-economy 0.1.2 ships the player-owned shop that lists, buys, cancels, and gifts through the player's own key.

**Depends on:** [`dl-node-rooted-claims`](#dl-node-rooted-claims), [`dl-node-swap-settlement`](#dl-node-swap-settlement).

**Acceptance**

- Verified: @keicoin/economy is published at 0.2.2 and @keicoin/player-economy at 0.1.2, both reachable from a plain install of kei-transaction@0.8.0, per the npm registry.

### Errors that state their own fix, across the grown surface {#dl-sdk-error-fixes}

<Badge type="warning" text="in-progress" /> · repositories `kei-transaction`

Every error is a sentence naming its own fix, never a code, because the agent reading it cannot ask a follow-up (SPEC.md section 6.1). The posture is established — the SDK rejects pay({ memo }) instead of silently dropping it, and a lost accept/cancel race reads as a normal retryable outcome — and the track keeps it true as economy surface grows.

**Acceptance**

- Closes when: the Economy DX done condition holds with every failure on the currency, item, shop, and trade path producing an error that names its own fix.

### wallet.signOwnershipChallenge() in the SDK {#dl-sdk-ownership-challenge}

<Badge type="info" text="planned" /> · repositories `kei-transaction`

The named unblocker for Button's multiplayer: a one-use, domain-separated ownership challenge the wallet re-derives before signing, so a game can verify address control without handling the player's key in its own code. Button PR #9's boundary was reviewed as sound; the SDK method it needs does not exist yet.

**Acceptance**

- Closes when: the published SDK exposes the ownership-challenge signing surface and Button's multiplayer no longer handles the player's key in its own code.

### The sixty-second path: install to confirmed payment {#dl-sdk-sixty-second-path}

<Badge type="tip" text="shipped" /> · repositories `kei-transaction`

Wallet creation, send, and a confirmed payment with no signup, key, or extension, with receives automatic and the payee's balance landing without the payee acting (SPEC.md section 6.2). The measured baseline holds from a clean install against the public testnet.

**Acceptance**

- Verified: wallet, send, and confirmed payment work from a clean install against https://testnet.keicoin.org/rpc with no signup, key, or extension, and automatic receive works, measured 3 August 2026, per the kei umbrella README.md.

### kei-transaction@0.8.0: the coordinated umbrella release {#dl-sdk-umbrella-release}

<Badge type="tip" text="shipped" /> · repositories `kei-transaction`

Every package is on npm and kei-transaction 0.8.0 reaches the coordinated graph: tokens 0.5.2, claims 0.5.1, wallet 0.5.0, economy 0.2.2, market 0.4.0, player-economy 0.1.2, core 0.5.0, and work 0.4.1. Market 0.4.0 adds defensive read bounds and ranks book levels by exact cross-multiplied price ratios; the earlier 0.6.0 umbrella first closed the 0.5.0 gap where kei.shop was undefined and the newer market was unreachable.

**Acceptance**

- Verified: kei-transaction@0.8.0 is published with dependencies on @keicoin/core@^0.5.0, work@^0.4.1, claims@^0.5.1, tokens@^0.5.2, market@^0.4.0, wallet@^0.5.0, economy@^0.2.2, and player-economy@^0.1.2, verified against the npm registry on 4 August 2026.

## Mainnet readiness — explicitly not a build task {#ms-mainnet-readiness}

<Badge type="danger" text="blocked" /> · horizon `post-v1` · owner `kei-node` · repositories `kei-node`

Mainnet is not a track and not a build task: it is gated by the network-security caveat, reserve governance, and the legal conversation, all of them and not any of them, resolved by argument and modelling rather than by shipping (SPEC.md section 13). Nothing anywhere in the project may be called mainnet-ready, no launch is implied, and no date exists.

**Depends on:** [`ms-reserve-governance`](#ms-reserve-governance).

**Blocked by:** [`dl-mainnet-legal-review`](#dl-mainnet-legal-review), [`dl-mainnet-stale-proposal-closure`](#dl-mainnet-stale-proposal-closure), [`dl-mainnet-validator-distribution`](#dl-mainnet-validator-distribution), [`ms-reserve-governance`](#ms-reserve-governance).

**Acceptance**

- Closes when: the validator-distribution exit criteria hold, the reserve governance mechanism is implemented and its thresholds modelled, the stale-proposal gap is closed, the genesis allocations verify, and the legal conversation has happened — all of them (SPEC.md sections 5.7, 15, and 17).

**Risks**

- A chain with a handful of nodes has weak consensus; encouraging anyone to hold value before the validator set is distributed is the named failure (SPEC.md section 5.9).
- At launch, 72 percent of circulating supply sits in project-held allocations, so early votes are decided by the project; this improves only as distribution widens and must be said publicly rather than discovered (SPEC.md section 5.7).
- The moment redemption for fiat exists the project is in money-transmission and possibly gambling territory; any cash-out-shaped API ships disabled and stays disabled until the legal conversation has happened (SPEC.md section 17).

### Genesis allocation and reserve set verified {#dl-mainnet-genesis-verification}

<Badge type="info" text="planned" /> · repositories `kei-node`

Total supply fixed at one trillion Kei with no protocol path to create more; circulating allocations summing to exactly 100 billion; the reserve accounts enumerated in the genesis block as a fixed immutable set with a null representative enforced by the node. A mismatch is a launch blocker (SPEC.md section 5.7).

**Acceptance**

- Closes when: the genesis block's circulating allocations sum to exactly 100,000,000,000 Kei, the reserve set is enumerated in genesis, and the node rejects any reserve-account block naming a real representative.

### The legal conversation {#dl-mainnet-legal-review}

<Badge type="info" text="planned" /> · repositories `kei-node`

The closed-loop posture reviewed with a lawyer before anything cash-out shaped exists; it gates mainnet in practice because mainnet is when value becomes real (SPEC.md sections 15 and 17).

**Acceptance**

- Closes when: the legal review of the closed-loop posture has happened and its outcome is recorded before any cash-out-shaped capability is enabled.

### Close the stale-proposal gap properly {#dl-mainnet-stale-proposal-closure}

<Badge type="info" text="planned" /> · repositories `kei-node`

Resolution-by-determination leaves a never-quorate proposal votable indefinitely against a forgotten weight snapshot; one-live-proposal and withdrawal bound it, but both levers are held by the beneficiary. SPEC.md section 15 requires closing this properly before mainnet.

**Acceptance**

- Closes when: a mechanism not held solely by the proposal's beneficiary bounds the lifetime of a never-quorate proposal, recorded in SPEC.md as settled.

### Validator distribution exit criteria {#dl-mainnet-validator-distribution}

<Badge type="info" text="planned" /> · repositories `kei-node`

At least ten independent unaffiliated representative operators, the largest single operator under 33 percent of online weight, and combined project-controlled weight under 34 percent, with a node-running guide shipping with the chain track; the developer-grants allocation is explicitly usable to fund representative operators (SPEC.md section 15).

**Acceptance**

- Closes when: at least 10 independent unaffiliated representative operators exist, the largest single operator holds under 33 percent of online weight, and combined project-controlled weight is under 34 percent.

## Reserve governance: the on-chain vote, designed from scratch {#ms-reserve-governance}

<Badge type="info" text="planned" /> · horizon `post-v1` · owner `kei-node` · repositories `kei-node`

Releasing any portion of the 90 percent reserve requires an on-chain vote — 51 percent quorum and 66 percent approval measured against circulating supply only, votes cast by representatives reusing ORV delegation, weight snapshotted when the proposal opens, resolution when the outcome is arithmetically determined, one live proposal at a time, and nothing moves on failure. Neither Nano nor Banano has any of this; it is new protocol work with no reference implementation, budgeted as the second-largest node item after tokens. Genesis can be built without it; mainnet cannot launch without it.

**Depends on:** [`dl-node-token-primitive`](#dl-node-token-primitive).

**Acceptance**

- Closes when: proposal records, vote tallying, quorum evaluation, and vote-gated execution are enforced by the node — a reserve transfer without a passing vote is an invalid block — with reserve accounts excluded from both governance and consensus weight (SPEC.md section 5.7).

**Risks**

- No prior art: no reference implementation, no battle-tested parameters, no known attack history; the 51/66 thresholds are provisional until modelled against realistic turnout.
- Early concentration: until circulating supply is meaningfully distributed, the reserve's real protection is its published address and multisig custody rather than the vote.

### Proposal, voting, and vote-gated release in consensus {#dl-gov-proposal-mechanism}

<Badge type="info" text="planned" /> · repositories `kei-node`

Proposal blocks binding amount, destination, purpose hash, and opening snapshot position; representative voting on the existing delegation graph; monotonic auditable tallies; approval at 51 percent quorum and 66 percent of weight cast; failure as soon as approval is arithmetically unreachable; at most one live proposal, with withdrawal.

**Acceptance**

- Closes when: a reserve transfer without a passing vote is rejected by every node, and a passing vote's release block becomes valid at the moment the outcome is determined, demonstrated by protocol tests.

### Reserve exclusion from all weight, enforced by the node {#dl-gov-reserve-exclusion}

<Badge type="info" text="planned" /> · repositories `kei-node`

Reserve accounts are enumerated in genesis, must name a reserved null representative, and carry zero governance and zero consensus weight; quorum and threshold are measured against circulating supply only, with reserve coins excluded from numerator and denominator. Without this, one cheap delegation block hands 90 percent of consensus weight to whoever holds it.

**Acceptance**

- Closes when: the node rejects any reserve-account block naming a real representative, and the weight calculation demonstrably excludes reserve balances from quorum, threshold, and consensus weight.

### Threshold modelling against realistic turnout {#dl-gov-threshold-modelling}

<Badge type="info" text="planned" /> · repositories `kei-node`

The 51 percent quorum and 66 percent approval figures were chosen before anyone modelled turnout, and 72 percent of launch circulating supply is project-held; both figures are parameters, not principles, and must be modelled against the delegation graph before mainnet (SPEC.md section 15).

**Depends on:** [`dl-gov-proposal-mechanism`](#dl-gov-proposal-mechanism).

**Acceptance**

- Closes when: realistic turnout has been modelled against the delegation graph and the quorum and approval figures are confirmed or adjusted on the record.

## Surfaces: wallet, examples, and the site {#ms-surfaces}

<Badge type="warning" text="in-progress" /> · horizon `near-term` · owner `keicoin-site` · repositories `button`, `kei-wallet`, `keicoin-site`, `world-of-wonder`

The parts that make the rest findable and checkable: the standalone wallet, the worked examples, and keicoin.org organised around the problem as somebody states it, because the reader deciding whether to adopt Kei is usually an agent answering somebody else's question. Every page claims only what a reader could verify in one step.

**Depends on:** [`dl-sdk-umbrella-release`](#dl-sdk-umbrella-release), [`ms-carpet-markets-criteria`](#ms-carpet-markets-criteria).

**Acceptance**

- Closes when: every claim on keicoin.org is checkable in one step from the page making it, the standalone wallet shows a player's items from a game that is not running, and all nine of SPEC.md section 9.6's criteria hold for Carpet Markets (SPEC.md section 13).

**Risks**

- Documentation drift: a site that drifts from its SDK is how an agent writes code against a function that no longer exists; the site is never the source of truth for the API.
- Example rot: a broken example is worse than a missing one; examples run in CI against the current SDK or are deleted.
- Agent-literal claims: overstatement on any page becomes a specification to the agent quoting it, and then a broken integration.

### Button, the canonical single-player demo {#dl-button-demo}

<Badge type="tip" text="shipped" /> · repositories `button`, `keicoin-site`

The smallest thing that exercises every primitive: press a button, bank presses, claim them, buy upgrades that live on the ledger instead of in a save file, restored by reading the chain on load. The deployed single-player game is the honest one.

**Depends on:** [`dl-sdk-sixty-second-path`](#dl-sdk-sixty-second-path).

**Acceptance**

- Verified: playable at keicoin.org/examples/button, hosted as a running demo, per the kei umbrella README.md and the site's /status record.

### Button multiplayer, merged and demonstrable {#dl-button-multiplayer}

<Badge type="danger" text="blocked" /> · repositories `button`

The first draft (PR #8) treated a client-supplied address as proof of control; PR #9 closed that with a one-use domain-separated challenge and review found the boundary sound. Both are closed and unmerged because the player's key is handled in Button's own code (the SDK lacks the ownership-challenge surface), nothing deployed can demonstrate the boundary (the deployed demo runs on a Durable Object and is single-player there), and there is no per-address observation ceiling.

**Depends on:** [`dl-sdk-ownership-challenge`](#dl-sdk-ownership-challenge).

**Blocked by:** [`dl-sdk-ownership-challenge`](#dl-sdk-ownership-challenge).

**Acceptance**

- Closes when: multiplayer merges with the ownership challenge supplied by the SDK rather than Button's own key handling, a deployed environment demonstrates the boundary, and a per-address observation ceiling exists.

### One source record per claim, held down by tests {#dl-site-claim-parity}

<Badge type="tip" text="shipped" /> · repositories `keicoin-site`

src/site/content.ts is the source record for the landing page, use-case pages, /status, llms.txt, and AGENTS.md; VitePress is the sole owner of /docs with a build-level parity test keeping the machine-readable economy claims on the deployed human quickstart; and the live corrections (nothing mainnet-ready, Carpet Markets is a mock-chain demo, Create Kei MMO does not produce a complete MMO, no milestone numbers) are enforced by tests.

**Acceptance**

- Verified: src/site/claims.test.ts and src/site/harness-docs.test.ts hold the four live corrections down under bun test, per keicoin-site/README.md.

### llms.txt, AGENTS.md, robots.txt, and the sitemap {#dl-site-machine-surface}

<Badge type="tip" text="shipped" /> · repositories `keicoin-site`

The machine-readable surface of SPEC.md sections 11.5 and 12, generated from the same source record as the human pages so the site cannot tell a human one thing and an agent another, published early because discovery compounds and cannot be started late.

**Depends on:** [`dl-site-claim-parity`](#dl-site-claim-parity).

**Acceptance**

- Verified: src/site/machine.ts renders llms.txt, AGENTS.md, robots.txt, and the sitemap from the shared source record, per keicoin-site/README.md.

### Every claim checkable in one step from the page making it {#dl-site-one-step-verification}

<Badge type="warning" text="in-progress" /> · repositories `keicoin-site`

The track's own condition for the site: prefer a command somebody can run or a URL they can open over a sentence they have to believe. /status already carries the commands behind its behavioural claims; the condition covers every page, continuously, as claims change.

**Depends on:** [`dl-site-claim-parity`](#dl-site-claim-parity).

**Acceptance**

- Closes when: every claim on keicoin.org is checkable in one step from the page making it, which is the Surfaces done condition in SPEC.md section 13.

### The in-game wallet panel (@keicoin/wallet) {#dl-wallet-ingame-panel}

<Badge type="tip" text="shipped" /> · repositories `kei-transaction`

The embeddable panel a game mounts inside itself — balance, inventory, pending claims, seed policy with reveal friction — distinct from the standalone kei-wallet application, and shipping in the umbrella.

**Depends on:** [`dl-sdk-umbrella-release`](#dl-sdk-umbrella-release).

**Acceptance**

- Verified: @keicoin/wallet is published at 0.5.0 and ships in kei-transaction@0.8.0, per the npm registry.

### The standalone wallet (kei-wallet), merged {#dl-wallet-standalone}

<Badge type="tip" text="shipped" /> · repositories `kei-wallet`

The BananoVault fork that makes players-own-their-items true rather than rhetorical — the exit door. Its market panel is wired to kei.market and shows that wallet's own offers, cancellable, and its settled trades; the network's book stays unshowable because an offer lives on its author's chain and Kei ships no indexer, and the panel says that rather than presenting a handful of offers as the market.

**Depends on:** [`dl-node-swap-settlement`](#dl-node-swap-settlement).

**Acceptance**

- Verified: the standalone wallet is on kei-wallet's default branch with its market panel wired to kei.market, per the site's /status record.

### The wallet shows items from a game that is not running {#dl-wallet-standalone-items}

<Badge type="warning" text="in-progress" /> · repositories `kei-wallet`

The Surfaces done condition names it: a player opens the standalone wallet and sees items earned in a game, without that game running (SPEC.md section 14, criterion 7). The wallet is merged and its market panel works; this specific item view demonstration is not yet in the verified baseline.

**Depends on:** [`dl-wallet-standalone`](#dl-wallet-standalone).

**Acceptance**

- Closes when: the standalone wallet demonstrably shows a player's on-chain items from a game that is not running.

### World of Wonder, the worked 3D MMO reference {#dl-wow-reference}

<Badge type="tip" text="shipped" /> · repositories `world-of-wonder`

The t5c fork (Babylon.js plus Colyseus) with an auction house over player-signed offers: Browse, Sell, and Mine read listings from player chains, and buying moves the item and gold in one settlement with the game server taking no part. Honest limits: the hosted copy runs a process-local mock chain so nothing on it survives a restart, the hall only knows accounts it has heard from, and merged phase one makes legacy inventory and gold rows inert while gameplay economy actions refuse because the wallet-proof verifier is not built. The repository settles on the public testnet by default.

**Depends on:** [`dl-node-swap-settlement`](#dl-node-swap-settlement).

**Acceptance**

- Verified: published as world-of-wonder and hosted at mmo.keicoin.org with the auction house implemented end to end, per the kei umbrella README.md and the site's /status record.

## v1: one external developer ships a game on Kei {#ms-v1-external-integration}

<Badge type="info" text="planned" /> · horizon `v1` · owner `project` · repositories `kei-node`, `kei-transaction`, `kei-wallet`, `keicoin-site`

The project's single definition of done at v1. The demo is the first user; v1 is defined by one external integration, not by scale, and no track substitutes for it. The four near-term tracks are what make the integration achievable, but the criterion itself is external and cannot be shipped from inside.

**Depends on:** [`ms-chain-and-network`](#ms-chain-and-network), [`ms-economy-dx`](#ms-economy-dx), [`ms-surfaces`](#ms-surfaces).

**Acceptance**

- Closes when: one external developer integrates Kei successfully and ships a game on it (SPEC.md section 14, criterion 10).

**Risks**

- Nobody uses it: building examples, features, or worlds into a vacuum before one external developer exists is the named failure mode of several previous projects.

### The SPEC.md section 14 acceptance criteria hold together {#dl-v1-acceptance-criteria}

<Badge type="warning" text="in-progress" /> · repositories `kei-node`, `kei-transaction`, `kei-wallet`

The ten project-level criteria: the sixty-second path, single-call issuance with no developer database, single-call balanceOf, a thousand simultaneous drops without an issuer bottleneck, full agent integration with funding as the only human step, the issuer seed failing loudly in a browser, the standalone wallet showing items offline, no seed in any log or request, the demo enjoyable with payments off, and one external integration. Several are in the verified baseline already; the set is only done when all ten hold at once.

**Depends on:** [`dl-sdk-sixty-second-path`](#dl-sdk-sixty-second-path), [`dl-wallet-standalone-items`](#dl-wallet-standalone-items).

**Acceptance**

- Verified: criteria 1 through 3 are in the measured baseline — a confirmed payment from a clean install with no signup, idempotent single-call issuance with the burn enforced, and single-call balanceOf, per the kei umbrella README.md.
- Closes when: all ten criteria of SPEC.md section 14 hold at the same time, including the external integration.

### The external integration itself {#dl-v1-external-ship}

<Badge type="info" text="planned" /> · repositories `keicoin-site`

A developer outside the project integrates Kei and ships a game. The site's job here is selection: being findable at the problem as stated and verifiable in one step, because the evaluation is written by an agent before the integration is.

**Depends on:** [`dl-v1-acceptance-criteria`](#dl-v1-acceptance-criteria).

**Acceptance**

- Closes when: a game by an external developer, integrating Kei, is shipped and publicly identifiable.

## Non-goals {#non-goals}

What the project refuses, with the reason and its source on the record. These are decisions, not backlog.

- **Allowances, approvals, operator delegation, and transfer hooks** `ng-allowances-hooks` — Excluded from the v1 token primitive; added only on concrete, demonstrated need. Operator delegation is the ERC-777 feature that most requires contracts. _Source: SPEC.md section 5.3._
- **A consensus clock, or any time-enforced deadline** `ng-consensus-clock` — A block-lattice has no agreed clock; every deadline is replaced by a signed act from the party whose asset is at stake. Adding consensus time touches the validation of every block type and is the single most dangerous change to an inherited node. _Source: SPEC.md sections 5.5 and 18._
- **Custodial wallet mode** `ng-custodial-wallet` — Not in v1 and not on the roadmap: it makes the developer a custodian, which is the burden Kei exists to remove. Reopen only on demand from a real external developer. _Source: SPEC.md section 15, settled._
- **General game-backend features (auth, leaderboards, matchmaking, analytics, cloud save, chat)** `ng-game-backend-features` — They need neither consensus nor custody, so they are ordinary database work; building them here makes Kei a worse PlayFab rather than a different one. Developers should use PlayFab alongside Kei. _Source: SPEC.md sections 3 and 4._
- **A global indexer or network-wide order book** `ng-global-indexer` — An offer lives on its author's chain; discovery is explicit, by registry or account-scoped reads. Every front end shows the accounts it has heard of and says so. _Source: SPEC.md sections 9.1 and 9.4._
- **Calling anything mainnet-ready** `ng-mainnet-ready-demos` — Mainnet is not a build task and no repository can ship its way through its gates; Carpet Markets in particular must refuse network mainnet outright, and does. _Source: SPEC.md sections 9.6, 13, and 18._
- **Meta-protocol tokens enforced by indexers** `ng-meta-protocol-tokens` — The technique behind Banano NFTs and BRC-20 puts token rules outside consensus, forcing the developer back into running payment infrastructure — the exact burden forking exists to remove. _Source: SPEC.md sections 5.2 and 18._
- **The project's own game world, MMO, or marketplace** `ng-own-game-world` — Anything requiring a population before it has value is out of scope by definition. Shipping a harness that helps developers build an MMO is the opposite thing: it needs no population to be worth anything. _Source: SPEC.md section 3._
- **Play-to-earn** `ng-play-to-earn` — Earning requires money to exit, which requires new money to enter, which requires perpetual new buyers — the Axie Infinity failure mode. Developers may build it on Kei; the project does not ship or promise it. _Source: SPEC.md section 3._
- **An on-chain exchange, AMM, order book, or pool primitive** `ng-pool-amm` — The chain moves assets; it does not price them. SPEC.md section 9.5 sketches what a node-enforced pool primitive would cost, as backlog and not planned work; building one reopens a settled decision and requires naming the feature that is impossible without it. _Source: SPEC.md sections 3, 9.5, and 18._
- **A renderer helper layer or @keicoin/presentation package** `ng-renderer-helper-layer` — Cut entirely: its two components belong in @keicoin/wallet, the core SDK stays framework-agnostic, and kei-transaction gains no animation, audio, or renderer layer. _Source: SPEC.md sections 6.8 and 11.3._
- **A smart contract VM** `ng-smart-contract-vm` — No EVM, no Solidity, no gas. A native token primitive is not a VM and must not grow into one; reopening requires naming the specific feature that is impossible without one. _Source: SPEC.md sections 3 and 18._
- **A token launchpad or speculation venue as product** `ng-token-launchpad` — Extractive, legally hazardous, and requiring a crowd to have value. Carpet Markets is defensible as satire precisely because its coins are worthless by construction; it is a demo of the market API, never this product. _Source: SPEC.md sections 3 and 9.6._
- **Unity and Unreal plugins** `ng-unity-unreal-plugins` — Later, maybe. Those developers already have payment rails; browser and WebGL hobbyists have none and are the wedge. _Source: SPEC.md section 3._
