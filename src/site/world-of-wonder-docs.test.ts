/**
 * World of Wonder defaults to the persistent public testnet, which requires a
 * fixed issuer seed. These checks keep the clean-clone commands executable and
 * keep the foreground server from hiding the client command behind it.
 */

import { describe, expect, test } from 'bun:test'

const page = await Bun.file(
  new URL('../../docs/examples/world-of-wonder.md', import.meta.url),
).text()

function section(heading: string): string {
  const start = page.indexOf(`## ${heading}`)
  const end = page.indexOf('\n## ', start + 1)
  return page.slice(start, end === -1 ? undefined : end)
}

describe('World of Wonder clean-clone commands', () => {
  test('runs the local server on the deterministic mock network', () => {
    expect(section('Tests')).toContain('KEI_NETWORK=mock npm run server-start &')
  })

  test('starts the foreground server and client in two labelled terminals', () => {
    const run = section('Run it')

    expect(run).toContain('**Terminal 1 — server:**')
    expect(run).toContain('KEI_NETWORK=mock npm run server-start')
    expect(run).toContain('**Terminal 2 — client:**')
    expect(run.indexOf('**Terminal 2 — client:**')).toBeLessThan(run.indexOf('npm run client-dev'))
  })
})
