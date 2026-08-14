import test from 'node:test'
import assert from 'node:assert/strict'
import { compactFigmaNode } from '../src/compact.js'

test('keeps implementation evidence and truncates deterministically', () => {
  const root = {
    id: '1:1',
    name: 'Card',
    type: 'FRAME',
    layoutMode: 'VERTICAL',
    itemSpacing: 12,
    paddingTop: 16,
    absoluteBoundingBox: { x: 0, y: 0, width: 320, height: 200 },
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
    children: [
      { id: '1:2', name: 'Title', type: 'TEXT', characters: 'Hello', style: { fontFamily: 'Inter', fontSize: 18 } },
      { id: '1:3', name: 'Body', type: 'TEXT', characters: 'World', style: { fontFamily: 'Inter', fontSize: 14 } },
    ],
  }
  const result = compactFigmaNode(root, { maxNodes: 2 })
  assert.equal(result.node.layout.layoutMode, 'VERTICAL')
  assert.equal(result.node.children[0].text.characters, 'Hello')
  assert.equal(result.node.childrenTruncated, 1)
  assert.deepEqual(result.stats, { included: 2, observed: 2, maxNodes: 2, truncated: true })
})

