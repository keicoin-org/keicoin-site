import { expect, test } from 'bun:test'

import { gateWorkRequest, type RateLimiter, type WorkGateEnv } from './work-gate.js'

const ROOT = 'A'.repeat(64)

function workRequest(tier = 'B', ip: string | null = '203.0.113.7'): Request {
  return new Request('https://keicoin.org/kei/work', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(ip ? { 'cf-connecting-ip': ip } : {}),
    },
    body: JSON.stringify({ action: 'work_generate', hash: ROOT, tier }),
  })
}

/** Records every key it is asked about, so the test can assert what it keyed on. */
function limiter(success: boolean): RateLimiter & { keys: string[] } {
  const keys: string[] = []
  return {
    keys,
    async limit({ key }) {
      keys.push(key)
      return { success }
    },
  }
}

async function refusal(verdict: Awaited<ReturnType<typeof gateWorkRequest>>): Promise<{
  status: number
  error: string
}> {
  if (verdict.ok) throw new Error('expected a refusal, got a pass')
  return { status: verdict.response.status, error: ((await verdict.response.json()) as { error: string }).error }
}

test('an unbound rate limiter closes the endpoint rather than opening it', async () => {
  expect(await refusal(await gateWorkRequest(workRequest(), {}))).toEqual({
    status: 503,
    error: 'the work server is not accepting requests',
  })
})

test('a request with no client IP is refused, because there is nothing to key on', async () => {
  const env: WorkGateEnv = { WORK_RATE_LIMIT: limiter(true) }
  expect((await refusal(await gateWorkRequest(workRequest('B', null), env))).status).toBe(403)
})

test('a request over the limit is refused, keyed on the client IP', async () => {
  const rate = limiter(false)
  const verdict = await gateWorkRequest(workRequest(), { WORK_RATE_LIMIT: rate })

  expect(rate.keys).toEqual(['203.0.113.7'])
  expect(await refusal(verdict)).toEqual({
    status: 429,
    error: 'too many work requests; generate work locally instead',
  })
})

test('tier A is refused however far under the rate limit the caller is', async () => {
  const env: WorkGateEnv = { WORK_RATE_LIMIT: limiter(true) }
  const { status, error } = await refusal(await gateWorkRequest(workRequest('A'), env))

  expect(status).toBe(403)
  expect(error).toContain('tier A is not served here')
})

test('the tiers the clicker sends pass, with a body the work server can still read', async () => {
  const env: WorkGateEnv = { WORK_RATE_LIMIT: limiter(true) }

  for (const tier of ['B', 'C']) {
    const verdict = await gateWorkRequest(workRequest(tier), env)
    if (!verdict.ok) throw new Error(`tier ${tier} was refused`)
    expect(await verdict.request.json()).toEqual({ action: 'work_generate', hash: ROOT, tier })
  }
})

test('a non-POST is passed through without spending quota', async () => {
  const rate = limiter(true)
  const request = new Request('https://keicoin.org/kei/work', { headers: { 'cf-connecting-ip': '203.0.113.7' } })
  const verdict = await gateWorkRequest(request, { WORK_RATE_LIMIT: rate })

  expect(verdict.ok).toBe(true)
  expect(rate.keys).toEqual([])
})

test('an oversized body is refused before it is parsed', async () => {
  const env: WorkGateEnv = { WORK_RATE_LIMIT: limiter(true) }
  const request = new Request('https://keicoin.org/kei/work', {
    method: 'POST',
    headers: { 'cf-connecting-ip': '203.0.113.7' },
    body: 'x'.repeat(8_193),
  })

  expect((await refusal(await gateWorkRequest(request, env))).status).toBe(413)
})
