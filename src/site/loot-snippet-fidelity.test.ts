/**
 * World of Wonder once changed its economy boundary while this guide continued
 * to describe the old database reward path. These assertions keep the public
 * page on the merged phase-one behaviour until the missing wallet verifier and
 * gameplay wiring really land.
 */

import { describe, expect, test } from 'bun:test'

const guide = await Bun.file(
  new URL('../../docs/examples/world-of-wonder/loot-and-drops.md', import.meta.url),
).text()

describe('the World of Wonder phase-one reward boundary', () => {
  test('does not present legacy rows as the current reward path', () => {
    expect(guide).toContain('the old database reward path is gone from gameplay authority')
    expect(guide).toContain('They are not loaded into the room\'s usable bag')
    expect(guide).not.toContain('The current loot path has no Kei tests')
  })

  test('states the shipped refusal at the same volume as the dormant implementation', () => {
    expect(guide).toContain('the running server wires `proofUnavailable`')
    expect(guide).toContain('no character can bind a wallet and those rewards refuse today')
    expect(guide).toContain('There is no browser route that asks for the challenge')
  })

  test('names the exact replay and failure direction', () => {
    expect(guide).toContain('Kills use the enemy session id')
    expect(guide).toContain('pickups use the loot entity id')
    expect(guide).toContain('quests use the character and quest key')
    expect(guide).toContain('can underpay one reward')
    expect(guide).toContain('cannot reopen it and mint without bound')
  })

  test('keeps direct mint distinct from a future rooted-claim scale path', () => {
    expect(guide).toContain('The phase-one service uses issuer-signed `grant` and `deliver` calls')
    expect(guide).toContain('Rooted claims remove the issuer write bottleneck')
    expect(guide).toContain('They do not prove a kill happened')
  })

  test('provides the one-step check and states what it cannot prove', () => {
    expect(guide).toContain('npm run test:inventory')
    expect(guide).toContain('They do **not** prove the missing browser-to-server wallet binding')
  })
})
