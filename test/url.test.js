import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFigmaUrl } from '../src/figma-url.js'

test('parses design URLs and normalizes node ids', () => {
  assert.deepEqual(
    parseFigmaUrl('https://www.figma.com/design/AbC_123/My-App?node-id=12-34'),
    {
      url: 'https://www.figma.com/design/AbC_123/My-App?node-id=12-34',
      fileType: 'design',
      fileKey: 'AbC_123',
      fileName: 'My-App',
      nodeId: '12:34',
    },
  )
})

test('accepts file URLs without a node id', () => {
  const parsed = parseFigmaUrl('https://figma.com/file/key-1/Library')
  assert.equal(parsed.fileKey, 'key-1')
  assert.equal(parsed.nodeId, undefined)
})

test('rejects lookalike hosts and non-file paths', () => {
  const lookalikeUrl = ['https:', '', 'figma.example', 'design', 'key', 'name'].join('/')
  assert.throws(() => parseFigmaUrl(lookalikeUrl), /figma.com/)
  assert.throws(() => parseFigmaUrl('https://www.figma.com/community/file/123'), /file key/)
})
