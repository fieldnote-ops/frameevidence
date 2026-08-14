import test from 'node:test'
import assert from 'node:assert/strict'
import { FigmaClient, filePath, renderPath } from '../src/figma-client.js'

test('sends the token only in the Figma header and caches responses', async () => {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url: url.toString(), init })
    return new Response(JSON.stringify({ name: 'Demo' }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  const client = new FigmaClient({ fetchImpl, baseUrl: 'https://api.figma.com/v1', cacheTtlMs: 1000, now: () => 10 })
  const first = await client.get('files/key?depth=2', 'secret')
  const second = await client.get('files/key?depth=2', 'secret')
  assert.deepEqual(first, second)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].init.headers['x-figma-token'], 'secret')
  assert.equal(calls[0].url.includes('secret'), false)
})

test('surfaces rate-limit recovery fields', async () => {
  const client = new FigmaClient({
    fetchImpl: async () => new Response(JSON.stringify({ message: 'limited' }), {
      status: 429,
      headers: { 'retry-after': '60', 'x-figma-plan-tier': 'starter' },
    }),
  })
  await assert.rejects(() => client.get('files/key', 'secret'), /retry after 60s.*starter/)
})

test('builds bounded file and render paths', () => {
  const reference = { fileKey: 'abc', nodeId: '1:2' }
  assert.equal(filePath(reference, 4), 'files/abc/nodes?depth=4&ids=1%3A2')
  assert.equal(renderPath(reference, 'png', 2), 'images/abc?ids=1%3A2&format=png&scale=2')
})

