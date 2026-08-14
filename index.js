import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { compactFigmaNode } from './src/compact.js'
import { FigmaClient, filePath, renderPath } from './src/figma-client.js'
import { parseFigmaUrl } from './src/figma-url.js'

export const name = 'frameevidence'
export const inject = ['tools']

export const Config = Schema.object({
  tokenEnv: Schema.string().default('FIGMA_ACCESS_TOKEN'),
  defaultDepth: Schema.number().default(4),
  maxDepth: Schema.number().default(8),
  maxNodes: Schema.number().default(300),
  timeoutMs: Schema.number().default(30_000),
  maxResponseBytes: Schema.number().default(8_388_608),
  cacheTtlMs: Schema.number().default(300_000),
})

function normalizeConfig(config = {}) {
  return {
    tokenEnv: config.tokenEnv ?? 'FIGMA_ACCESS_TOKEN',
    defaultDepth: config.defaultDepth ?? 4,
    maxDepth: config.maxDepth ?? 8,
    maxNodes: config.maxNodes ?? 300,
    timeoutMs: config.timeoutMs ?? 30_000,
    maxResponseBytes: config.maxResponseBytes ?? 8_388_608,
    cacheTtlMs: config.cacheTtlMs ?? 300_000,
  }
}

function validateConfig(config) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(config.tokenEnv)) throw new Error('tokenEnv must be an environment-variable name')
  for (const [key, value, min, max] of [
    ['defaultDepth', config.defaultDepth, 1, 20],
    ['maxDepth', config.maxDepth, 1, 20],
    ['maxNodes', config.maxNodes, 1, 5_000],
    ['timeoutMs', config.timeoutMs, 1_000, 120_000],
    ['maxResponseBytes', config.maxResponseBytes, 65_536, 67_108_864],
    ['cacheTtlMs', config.cacheTtlMs, 0, 86_400_000],
  ]) {
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} must be an integer between ${min} and ${max}`)
  }
  if (config.defaultDepth > config.maxDepth) throw new Error('defaultDepth cannot exceed maxDepth')
}

function jsonContent(value) {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function requireToken(config, env = process.env) {
  const token = env[config.tokenEnv]
  if (!token) throw new Error(`Figma credential is missing: set ${config.tokenEnv} with file_content:read scope`)
  return token
}

function selectedRoot(response, reference) {
  if (!reference.nodeId) return response.document
  const record = response.nodes?.[reference.nodeId]
  if (!record?.document) throw new Error(`Figma node was not found: ${reference.nodeId}`)
  return record.document
}

function safeTemporaryAssetUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error('Figma returned an invalid render URL')
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Figma returned an unsafe render URL')
  }
  return url.toString()
}

export function apply(ctx, inputConfig) {
  const config = normalizeConfig(inputConfig)
  validateConfig(config)
  const client = new FigmaClient(config)

  ctx.tools.register(defineTool({
    name: 'figma_inspect',
    description: 'Read implementation-relevant layout, typography, paint, component, and variable-binding evidence from a Figma file or node URL. Use this before coding from a design.',
    parameters: {
      url: { type: 'string', required: true, description: 'HTTPS Figma file or node URL' },
      depth: { type: 'number', description: `Tree depth to retrieve (1-${config.maxDepth}; default ${config.defaultDepth})` },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => jsonContent(value),
    },
    async execute(args, exec) {
      const reference = parseFigmaUrl(args.url)
      const depth = args.depth === undefined ? config.defaultDepth : Math.trunc(args.depth)
      if (depth < 1 || depth > config.maxDepth) throw new Error(`depth must be between 1 and ${config.maxDepth}`)
      const response = await client.get(filePath(reference, depth), requireToken(config), exec?.signal)
      const root = selectedRoot(response, reference)
      const compact = compactFigmaNode(root, { maxNodes: config.maxNodes })
      return {
        source: {
          url: reference.url,
          fileKey: reference.fileKey,
          nodeId: reference.nodeId,
          fileName: response.name ?? reference.fileName,
          lastModified: response.lastModified,
          version: response.version,
          editorType: response.editorType,
        },
        evidence: compact.node,
        stats: {
          ...compact.stats,
          componentsReferenced: Object.keys(response.components ?? {}).length,
          componentSetsReferenced: Object.keys(response.componentSets ?? {}).length,
          stylesReferenced: Object.keys(response.styles ?? {}).length,
        },
        limitations: [
          'This is a bounded structural snapshot, not generated production code.',
          'Figma Variables values are not fetched in v0.1; bound variable ids are preserved when present.',
          'Hidden descendants and nodes beyond the configured depth or node cap may be absent.',
        ],
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'figma_render',
    description: 'Render one Figma node as a PNG, JPG, SVG, or PDF and return the temporary Figma-hosted asset URL.',
    parameters: {
      url: { type: 'string', required: true, description: 'HTTPS Figma URL containing node-id' },
      format: { type: 'string', enum: ['png', 'jpg', 'svg', 'pdf'], description: 'Output format (default png)' },
      scale: { type: 'number', description: 'Bitmap scale from 0.01 to 4 (default 1; ignored for SVG/PDF)' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => jsonContent(value),
    },
    async execute(args, exec) {
      const reference = parseFigmaUrl(args.url)
      const format = args.format ?? 'png'
      if (!['png', 'jpg', 'svg', 'pdf'].includes(format)) throw new Error('format must be png, jpg, svg, or pdf')
      const scale = args.scale === undefined ? 1 : Number(args.scale)
      if (!Number.isFinite(scale) || scale < 0.01 || scale > 4) throw new Error('scale must be between 0.01 and 4')
      const response = await client.get(renderPath(reference, format, scale), requireToken(config), exec?.signal)
      const imageUrl = response.images?.[reference.nodeId]
      if (!imageUrl) throw new Error(`Figma could not render node ${reference.nodeId}`)
      return {
        source: { url: reference.url, fileKey: reference.fileKey, nodeId: reference.nodeId },
        format,
        scale: format === 'png' || format === 'jpg' ? scale : undefined,
        imageUrl: safeTemporaryAssetUrl(imageUrl),
        limitation: 'Figma-hosted render URLs are temporary; download the asset if it must be durable.',
      }
    },
  }))
}

export { compactFigmaNode, FigmaClient, parseFigmaUrl }
