const DEFAULT_BASE_URL = 'https://api.figma.com/v1'

async function readBounded(response, maxBytes) {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`Figma response exceeds the ${maxBytes} byte limit`)
  }
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error(`Figma response exceeds the ${maxBytes} byte limit`)
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

function messageFromBody(text) {
  if (!text) return undefined
  try {
    const value = JSON.parse(text)
    return value.message ?? value.err ?? value.error
  } catch {
    return text.slice(0, 300)
  }
}

export class FigmaClient {
  constructor(options = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.maxResponseBytes = options.maxResponseBytes ?? 8_388_608
    this.cacheTtlMs = options.cacheTtlMs ?? 300_000
    this.now = options.now ?? Date.now
    this.cache = new Map()
  }

  async get(path, token, signal) {
    const cached = this.cache.get(path)
    if (cached && cached.expiresAt > this.now()) return cached.value

    const timeoutSignal = AbortSignal.timeout(this.timeoutMs)
    const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
    const response = await this.fetchImpl(new URL(path, `${this.baseUrl}/`), {
      method: 'GET',
      redirect: 'error',
      headers: {
        accept: 'application/json',
        'x-figma-token': token,
      },
      signal: combinedSignal,
    })
    const text = await readBounded(response, this.maxResponseBytes)

    if (!response.ok) {
      const detail = messageFromBody(text)
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after')
        const plan = response.headers.get('x-figma-plan-tier')
        throw new Error(`Figma rate limit reached${retryAfter ? `; retry after ${retryAfter}s` : ''}${plan ? ` (plan: ${plan})` : ''}`)
      }
      if (response.status === 403) {
        throw new Error(`Figma denied the request; check token expiry, file access, and file_content:read scope${detail ? `: ${detail}` : ''}`)
      }
      throw new Error(`Figma API returned HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
    }

    let value
    try {
      value = JSON.parse(text)
    } catch {
      throw new Error('Figma API returned invalid JSON')
    }
    this.cache.set(path, { value, expiresAt: this.now() + this.cacheTtlMs })
    return value
  }
}

export function filePath(reference, depth) {
  const params = new URLSearchParams({ depth: String(depth) })
  if (reference.nodeId) {
    params.set('ids', reference.nodeId)
    return `files/${encodeURIComponent(reference.fileKey)}/nodes?${params}`
  }
  return `files/${encodeURIComponent(reference.fileKey)}?${params}`
}

export function renderPath(reference, format, scale) {
  if (!reference.nodeId) throw new Error('figma_render needs a Figma URL with a node-id query parameter')
  const params = new URLSearchParams({ ids: reference.nodeId, format })
  if (format === 'png' || format === 'jpg') params.set('scale', String(scale))
  return `images/${encodeURIComponent(reference.fileKey)}?${params}`
}

