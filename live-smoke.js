import {
  closeSync,
  fsyncSync,
  openSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { apply, parseFigmaUrl } from './index.js'

const TOKEN_ENV_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

function resolveNewReportPath(workspace, value) {
  const workspaceReal = realpathSync(workspace)
  if (isAbsolute(value) || basename(value) !== value || value === '.' || value === '..') {
    throw new Error('FRAMEEVIDENCE_REPORT must be a new file name in the current workspace')
  }
  return join(workspaceReal, value)
}

export function readLiveSmokeConfig(env = process.env, cwd = process.cwd()) {
  const tokenEnv = env.FRAMEEVIDENCE_TOKEN_ENV?.trim() || 'FIGMA_ACCESS_TOKEN'
  if (!TOKEN_ENV_PATTERN.test(tokenEnv)) throw new Error('FRAMEEVIDENCE_TOKEN_ENV must name an environment variable')
  if (!env[tokenEnv]) throw new Error(`Figma credential is missing from ${tokenEnv}`)
  const url = env.FRAMEEVIDENCE_URL?.trim()
  if (!url) throw new Error('FRAMEEVIDENCE_URL is required')
  const reference = parseFigmaUrl(url)
  if (!reference.nodeId) throw new Error('FRAMEEVIDENCE_URL must contain a node-id so both tools can be verified')
  const reportPath = resolveNewReportPath(cwd, env.FRAMEEVIDENCE_REPORT?.trim() || 'frameevidence-live-smoke.json')
  return { tokenEnv, url, reportPath }
}

export async function runLiveSmoke(config, dependencies = {}) {
  const registered = []
  const applyPlugin = dependencies.applyPlugin ?? apply
  applyPlugin({ tools: { register(tool) { registered.push(tool) } } }, {
    tokenEnv: config.tokenEnv,
    cacheTtlMs: 0,
  })
  const inspectTool = registered.find(tool => tool.name === 'figma_inspect')
  const renderTool = registered.find(tool => tool.name === 'figma_render')
  if (!inspectTool || !renderTool) throw new Error('FrameEvidence did not register both required tools')

  const inspect = await inspectTool.execute({ url: config.url }, {})
  const render = await renderTool.execute({ url: config.url, format: 'png', scale: 1 }, {})
  const included = Number(inspect?.stats?.included)
  if (!Number.isInteger(included) || included < 1) throw new Error('figma_inspect returned no bounded nodes')
  let renderUrl
  try {
    renderUrl = new URL(render?.imageUrl)
  } catch {
    throw new Error('figma_render did not return a valid asset URL')
  }
  if (renderUrl.protocol !== 'https:' || renderUrl.username || renderUrl.password) {
    throw new Error('figma_render did not return a safe HTTPS asset URL')
  }

  return {
    schemaVersion: 1,
    decision: 'pass',
    product: 'FrameEvidence',
    version: '0.1.2',
    protocol: 'Figma REST file-node inspection plus PNG render request',
    checks: {
      inspectCompleted: true,
      renderCompleted: true,
      boundedNodeCount: included,
      nodeLimitReached: inspect.stats.truncated === true,
      renderFormat: render.format,
      renderScale: render.scale,
    },
    security: {
      credentialFromProcessEnvironment: true,
      credentialRecorded: false,
      sourceUrlRecorded: false,
      fileKeyRecorded: false,
      nodeIdRecorded: false,
      nodeNameRecorded: false,
      renderUrlRecorded: false,
      rawApiResponseRecorded: false,
    },
    evidenceLimit: 'Proves one credentialed read-only inspection and one render-URL response for a caller-selected node. It does not prove pixel fidelity, design ownership, write access, independent adoption, or Marketplace acceptance.',
  }
}

export function writeLiveSmokeReport(reportPath, report) {
  const file = openSync(reportPath, 'wx', 0o600)
  try {
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    fsyncSync(file)
  } finally {
    closeSync(file)
  }
}

async function main() {
  try {
    const config = readLiveSmokeConfig()
    const report = await runLiveSmoke(config)
    writeLiveSmokeReport(config.reportPath, report)
    process.stdout.write(`FrameEvidence live smoke passed; sanitized report: ${relative(process.cwd(), config.reportPath)}\n`)
  } catch {
    process.stderr.write('FrameEvidence live smoke failed; review token scope, file access, node URL, network, API limits, and the new-report path. No raw API detail was written.\n')
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await main()
