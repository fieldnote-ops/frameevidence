function rounded(value) {
  return typeof value === 'number' ? Math.round(value * 100) / 100 : undefined
}

function compactColor(color, opacity) {
  if (!color) return undefined
  const alpha = opacity ?? color.a ?? 1
  return {
    r: rounded(color.r),
    g: rounded(color.g),
    b: rounded(color.b),
    a: rounded(alpha),
  }
}

function compactPaint(paint) {
  const output = { type: paint.type }
  if (paint.visible === false) output.visible = false
  if (paint.opacity !== undefined) output.opacity = rounded(paint.opacity)
  if (paint.color) output.color = compactColor(paint.color, paint.opacity)
  if (paint.blendMode && paint.blendMode !== 'NORMAL') output.blendMode = paint.blendMode
  if (paint.imageRef) output.imageRef = paint.imageRef
  if (paint.scaleMode) output.scaleMode = paint.scaleMode
  if (Array.isArray(paint.gradientStops)) {
    output.gradientStops = paint.gradientStops.slice(0, 12).map(stop => ({
      position: rounded(stop.position),
      color: compactColor(stop.color),
    }))
  }
  return output
}

function compactEffects(effects) {
  return effects.slice(0, 8).map(effect => ({
    type: effect.type,
    visible: effect.visible,
    radius: rounded(effect.radius),
    spread: rounded(effect.spread),
    offset: effect.offset ? { x: rounded(effect.offset.x), y: rounded(effect.offset.y) } : undefined,
    color: compactColor(effect.color),
  }))
}

function compactBounds(bounds) {
  if (!bounds) return undefined
  return {
    x: rounded(bounds.x),
    y: rounded(bounds.y),
    width: rounded(bounds.width),
    height: rounded(bounds.height),
  }
}

function compactLayout(node) {
  const keys = [
    'layoutMode', 'layoutWrap', 'primaryAxisAlignItems', 'counterAxisAlignItems',
    'primaryAxisSizingMode', 'counterAxisSizingMode', 'layoutSizingHorizontal',
    'layoutSizingVertical', 'itemSpacing', 'counterAxisSpacing', 'paddingTop',
    'paddingRight', 'paddingBottom', 'paddingLeft', 'clipsContent',
  ]
  const output = {}
  for (const key of keys) if (node[key] !== undefined) output[key] = node[key]
  return Object.keys(output).length ? output : undefined
}

function compactText(node) {
  if (node.type !== 'TEXT') return undefined
  const characters = typeof node.characters === 'string' ? node.characters : ''
  const style = node.style ?? {}
  return {
    characters: characters.length > 500 ? `${characters.slice(0, 500)}…` : characters,
    truncated: characters.length > 500 || undefined,
    style: {
      fontFamily: style.fontFamily,
      fontPostScriptName: style.fontPostScriptName,
      fontStyle: style.fontStyle,
      fontWeight: style.fontWeight,
      fontSize: rounded(style.fontSize),
      lineHeightPx: rounded(style.lineHeightPx),
      lineHeightPercent: rounded(style.lineHeightPercent),
      letterSpacing: rounded(style.letterSpacing),
      textAlignHorizontal: style.textAlignHorizontal,
      textCase: style.textCase,
      textDecoration: style.textDecoration,
    },
  }
}

/** Reduce Figma's large node schema to implementation-relevant evidence with a hard node cap. */
export function compactFigmaNode(root, options = {}) {
  const maxNodes = options.maxNodes ?? 300
  let included = 0
  let observed = 0
  let truncated = false

  function visit(node) {
    observed += 1
    if (included >= maxNodes) {
      truncated = true
      return undefined
    }
    included += 1

    const output = {
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible === false ? false : undefined,
      bounds: compactBounds(node.absoluteBoundingBox ?? node.absoluteRenderBounds),
      layout: compactLayout(node),
      opacity: node.opacity !== undefined && node.opacity !== 1 ? rounded(node.opacity) : undefined,
      blendMode: node.blendMode && node.blendMode !== 'PASS_THROUGH' ? node.blendMode : undefined,
      fills: Array.isArray(node.fills) ? node.fills.slice(0, 12).map(compactPaint) : undefined,
      strokes: Array.isArray(node.strokes) ? node.strokes.slice(0, 8).map(compactPaint) : undefined,
      strokeWeight: rounded(node.strokeWeight),
      cornerRadius: rounded(node.cornerRadius),
      effects: Array.isArray(node.effects) && node.effects.length ? compactEffects(node.effects) : undefined,
      text: compactText(node),
      componentId: node.componentId,
      componentProperties: node.componentProperties,
      styleRefs: node.styles,
      boundVariables: node.boundVariables,
    }

    if (Array.isArray(node.children) && node.children.length) {
      const children = []
      for (const child of node.children) {
        const compact = visit(child)
        if (compact) children.push(compact)
        if (included >= maxNodes) {
          if (children.length < node.children.length) truncated = true
          break
        }
      }
      if (children.length) output.children = children
      if (children.length < node.children.length) output.childrenTruncated = node.children.length - children.length
    }
    return output
  }

  const node = visit(root)
  return {
    node,
    stats: { included, observed, maxNodes, truncated },
  }
}
