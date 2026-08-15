import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { readLiveSmokeConfig, runLiveSmoke, writeLiveSmokeReport } from '../live-smoke.js'

const NODE_URL = 'https://www.figma.com/design/AbC123/Synthetic?node-id=1-2'

test('requires a credential, node URL, and workspace-local new report', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'frameevidence-live-'))
  assert.throws(() => readLiveSmokeConfig({ FRAMEEVIDENCE_URL: NODE_URL }, workspace), /credential is missing/)
  assert.throws(() => readLiveSmokeConfig({ FIGMA_ACCESS_TOKEN: 'secret', FRAMEEVIDENCE_URL: 'https://www.figma.com/design/AbC123/Synthetic' }, workspace), /node-id/)
  assert.throws(() => readLiveSmokeConfig({ FIGMA_ACCESS_TOKEN: 'secret', FRAMEEVIDENCE_URL: NODE_URL, FRAMEEVIDENCE_REPORT: '../outside.json' }, workspace), /current workspace/)
})

test('runs both tool paths and returns only bounded sanitized evidence', async () => {
  const calls = []
  const applyPlugin = (ctx) => {
    ctx.tools.register({
      name: 'figma_inspect',
      async execute(args) {
        calls.push(['inspect', args])
        return {
          source: { url: args.url, fileKey: 'private-key', nodeId: '1:2', fileName: 'Private design' },
          evidence: { id: '1:2', name: 'Private frame', type: 'FRAME' },
          stats: { included: 7, truncated: false },
        }
      },
    })
    ctx.tools.register({
      name: 'figma_render',
      async execute(args) {
        calls.push(['render', args])
        return { format: 'png', scale: 1, imageUrl: 'https://figmausercontent.example/private.png' }
      },
    })
  }
  const report = await runLiveSmoke({ tokenEnv: 'FIGMA_ACCESS_TOKEN', url: NODE_URL }, { applyPlugin })
  assert.deepEqual(calls.map(([name]) => name), ['inspect', 'render'])
  assert.equal(report.checks.boundedNodeCount, 7)
  const serialized = JSON.stringify(report)
  for (const secret of ['AbC123', '1:2', 'Private design', 'Private frame', 'figmausercontent.example']) {
    assert.equal(serialized.includes(secret), false)
  }
  assert.equal(report.security.credentialRecorded, false)
  assert.equal(report.security.renderUrlRecorded, false)
})

test('creates one 0600 report and refuses to overwrite it', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'frameevidence-live-'))
  const config = readLiveSmokeConfig({ FIGMA_ACCESS_TOKEN: 'secret', FRAMEEVIDENCE_URL: NODE_URL }, workspace)
  const report = { schemaVersion: 1, decision: 'pass' }
  writeLiveSmokeReport(config.reportPath, report)
  assert.equal(statSync(config.reportPath).mode & 0o777, 0o600)
  assert.deepEqual(JSON.parse(readFileSync(config.reportPath, 'utf8')), report)
  assert.throws(() => writeLiveSmokeReport(config.reportPath, report), /EEXIST/)
})

test('rejects a credential-bearing render URL even behind a tool adapter', async () => {
  const applyPlugin = (ctx) => {
    ctx.tools.register({ name: 'figma_inspect', async execute() { return { stats: { included: 1 } } } })
    ctx.tools.register({ name: 'figma_render', async execute() { return { format: 'png', scale: 1, imageUrl: 'https://user:pass@example.test/private.png' } } })
  }
  await assert.rejects(
    () => runLiveSmoke({ tokenEnv: 'FIGMA_ACCESS_TOKEN', url: NODE_URL }, { applyPlugin }),
    /safe HTTPS asset URL/,
  )
})
