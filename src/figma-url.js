const FIGMA_HOSTS = new Set(['figma.com', 'www.figma.com'])
const FILE_TYPES = new Set(['design', 'file', 'proto', 'board', 'slides', 'make'])

function normalizeNodeId(value) {
  if (!value) return undefined
  const decoded = decodeURIComponent(value).trim()
  if (!decoded) return undefined
  return decoded.includes(':') ? decoded : decoded.replaceAll('-', ':')
}

/** Parse a public Figma file/node URL without accepting credentials or lookalike hosts. */
export function parseFigmaUrl(input) {
  let url
  try {
    url = new URL(input)
  } catch {
    throw new Error('Expected a complete Figma URL, for example https://www.figma.com/design/<file-key>/<name>?node-id=1-2')
  }

  if (url.protocol !== 'https:' || !FIGMA_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('Only HTTPS URLs on figma.com are accepted')
  }
  if (url.username || url.password) throw new Error('Credentials in a Figma URL are not allowed')

  const parts = url.pathname.split('/').filter(Boolean)
  const fileType = parts[0]
  const fileKey = parts[1]
  if (!FILE_TYPES.has(fileType) || !fileKey || !/^[A-Za-z0-9_-]+$/.test(fileKey)) {
    throw new Error('The URL does not contain a supported Figma file key')
  }

  return {
    url: url.toString(),
    fileType,
    fileKey,
    fileName: parts[2] ? decodeURIComponent(parts[2]) : undefined,
    nodeId: normalizeNodeId(url.searchParams.get('node-id')),
  }
}

