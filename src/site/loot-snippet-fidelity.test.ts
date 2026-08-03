/**
 * The loot guide's migration snippet is unbuilt code, so nothing runs it and a
 * wrong signature can sit there indefinitely. This reads the markdown as text
 * and checks the few markers that were actually wrong once: the entry shape
 * `{ to, item }`, the array of commits back, and the claim signed by the holder.
 *
 * Deliberately string assertions on the file. Executing fenced blocks would mean
 * a toolchain that parses markdown and stubs a ledger, which is far more
 * machinery than the one signature it would protect.
 */

import { describe, expect, test } from 'bun:test'

const guide = await Bun.file(
  new URL('../../docs/examples/world-of-wonder/loot-and-drops.md', import.meta.url),
).text()

const migration = guide.slice(guide.indexOf('## The intended migration'), guide.indexOf('## Rules for whoever'))

describe('the loot migration snippet', () => {
  test('commits entries shaped { to, item }, never an amount', () => {
    expect(migration).toContain('await game.items.commit([')
    expect(migration).toContain('{ to: playerA.address, item: potion.id },')
    // `amount:` is the currency commit's field. An item commit has no quantity:
    // one entry is one unit of one asset. Matched with the colon so the prose
    // below, which talks about a changed amount, stays allowed to say so.
    expect(migration).not.toContain('amount:')
  })

  test('takes back an array of commits and claims per drop', () => {
    expect(migration).toContain('const drops = await game.items.commit([')
    expect(migration).toContain('for (const drop of drops) {')
    expect(migration).toContain('drop.recipients.includes(who.address)')
  })

  test('only an eligible holder claims, and they sign it themselves', () => {
    expect(migration).toContain('await who.claims.add(drop.proofFor(who.address))')
  })

  test('says one issuer block per item, not one per batch', () => {
    expect(migration).toContain('one issuer block per distinct item asset')
    expect(guide).not.toContain('once per batch')
    expect(guide).not.toContain('one commitment for a batch')
  })

  test('the boundary stays candid: this section is still unbuilt', () => {
    expect(guide).toContain('There is no network loot claim in World of Wonder today.')
    expect(guide).toContain('The next section is a design, and it is unbuilt.')
  })

  test('describes proof delivery as recipient-bound, not bearer authority', () => {
    expect(guide).toContain('The proof bundle is recipient-bound')
    expect(guide).toContain('a bundle that reaches the wrong wallet cannot be claimed by it')
    expect(guide).not.toContain('bearer credential')
  })
})
