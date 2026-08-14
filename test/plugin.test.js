import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../index.js'

test('registers the two model-facing tools', () => {
  const tools = []
  apply({ tools: { register(tool) { tools.push(tool) } } }, {})
  assert.deepEqual(tools.map(tool => tool.name), ['figma_inspect', 'figma_render'])
})

test('validates configuration before registering tools', () => {
  assert.throws(() => apply({ tools: { register() {} } }, { defaultDepth: 9, maxDepth: 8 }), /defaultDepth/)
})

test('executes bounded inspection without exposing the token', async () => {
  const priorFetch = globalThis.fetch
  const priorToken = process.env.FRAMEEVIDENCE_TEST_TOKEN
  const tools = []
  process.env.FRAMEEVIDENCE_TEST_TOKEN = 'test-secret-value'
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers['x-figma-token'], 'test-secret-value')
    return new Response(JSON.stringify({
      name: 'Synthetic file',
      document: { id: '0:0', name: 'Page', type: 'DOCUMENT', children: [] },
    }), { status: 200 })
  }
  try {
    apply({ tools: { register(tool) { tools.push(tool) } } }, { tokenEnv: 'FRAMEEVIDENCE_TEST_TOKEN' })
    const result = await tools[0].execute({ url: 'https://www.figma.com/design/AbC123/Synthetic' }, {})
    assert.equal(result.source.fileName, 'Synthetic file')
    assert.equal(JSON.stringify(result).includes('test-secret-value'), false)
  } finally {
    globalThis.fetch = priorFetch
    if (priorToken === undefined) delete process.env.FRAMEEVIDENCE_TEST_TOKEN
    else process.env.FRAMEEVIDENCE_TEST_TOKEN = priorToken
  }
})

test('rejects unsafe render URLs returned by the API', async () => {
  const priorFetch = globalThis.fetch
  const priorToken = process.env.FRAMEEVIDENCE_TEST_TOKEN
  const tools = []
  process.env.FRAMEEVIDENCE_TEST_TOKEN = 'test-secret-value'
  const unsafeRenderUrl = ['http:', '', 'example.test', 'render.png'].join('/')
  globalThis.fetch = async () => new Response(JSON.stringify({ images: { '1:2': unsafeRenderUrl } }), { status: 200 })
  try {
    apply({ tools: { register(tool) { tools.push(tool) } } }, { tokenEnv: 'FRAMEEVIDENCE_TEST_TOKEN' })
    await assert.rejects(
      () => tools[1].execute({ url: 'https://www.figma.com/design/AbC123/Synthetic?node-id=1-2' }, {}),
      /unsafe render URL/,
    )
  } finally {
    globalThis.fetch = priorFetch
    if (priorToken === undefined) delete process.env.FRAMEEVIDENCE_TEST_TOKEN
    else process.env.FRAMEEVIDENCE_TEST_TOKEN = priorToken
  }
})
