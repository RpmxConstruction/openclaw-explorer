import { useMemo, useCallback, memo } from 'react'
import * as d3 from 'd3'
import { FileSystemItem } from '../../types'
import TreeNode from './TreeNode'

interface GroupCircleProps {
  label: string
  items: FileSystemItem[]
  cx: number
  cy: number
  isFolder: boolean
  expandedPaths: Set<string>
  onItemClick: (item: FileSystemItem) => void
}

const ITEM_HEIGHT = 36
const PADDING = 20
const GAP = 8 // Minimum gap between items

// Get width of a TreeNode item
function getItemWidth(item: FileSystemItem): number {
  return Math.max(120, item.name.length * 10 + 40)
}

// Get collision radius for a rectangular item (using diagonal/2 + gap)
function getCollisionRadius(width: number): number {
  return Math.sqrt(width * width + ITEM_HEIGHT * ITEM_HEIGHT) / 2 + GAP / 2
}

interface SimNode {
  item: FileSystemItem
  width: number
  collisionRadius: number
  x?: number
  y?: number
  vx?: number
  vy?: number
}

// Custom force to constrain rectangular items within a circular boundary
function forceCircularBoundary(nodes: SimNode[], targetRadius: number) {
  return () => {
    for (const node of nodes) {
      if (node.x === undefined || node.y === undefined) continue

      const halfW = node.width / 2
      const halfH = ITEM_HEIGHT / 2
      const maxCornerDist = Math.sqrt(halfW * halfW + halfH * halfH)

      // The center of the node should stay within (targetRadius - maxCornerDist)
      const maxNodeDist = targetRadius - maxCornerDist - GAP
      const dist = Math.sqrt(node.x * node.x + node.y * node.y)

      if (dist > maxNodeDist && dist > 0) {
        // Push back proportionally to how far outside the boundary
        const scale = maxNodeDist / dist
        const strength = 0.3
        node.vx = (node.vx || 0) - (node.x - node.x * scale) * strength
        node.vy = (node.vy || 0) - (node.y - node.y * scale) * strength
      }
    }
  }
}

// Layout items using D3 force simulation with circular boundary
function layoutCircular(items: FileSystemItem[]): { positions: { item: FileSystemItem, x: number, y: number }[], radius: number } {
  if (items.length === 0) return { positions: [], radius: 0 }

  if (items.length === 1) {
    return {
      positions: [{ item: items[0], x: 0, y: 0 }],
      radius: getItemWidth(items[0]) / 2 + PADDING
    }
  }

  // Create nodes for simulation
  const nodes: SimNode[] = items.map((item, i) => {
    const width = getItemWidth(item)
    const collisionRadius = getCollisionRadius(width)
    // Initialize in a compact spiral pattern
    const angle = i * Math.PI * (3 - Math.sqrt(5)) // Golden angle
    const r = Math.sqrt(i + 1) * 20
    return {
      item,
      width,
      collisionRadius,
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r
    }
  })

  // Calculate target radius - start with area-based estimate
  const avgCollisionRadius = nodes.reduce((sum, n) => sum + n.collisionRadius, 0) / nodes.length
  const totalCollisionArea = nodes.reduce((sum, n) => sum + Math.PI * n.collisionRadius * n.collisionRadius, 0)
  const fillRatio = 0.45 // Target ~45% fill for comfortable spacing
  let targetRadius = Math.sqrt(totalCollisionArea / (Math.PI * fillRatio))

  // Ensure minimum radius accounts for largest item
  const maxItemRadius = Math.max(...nodes.map(n => Math.sqrt((n.width/2)**2 + (ITEM_HEIGHT/2)**2)))
  targetRadius = Math.max(targetRadius, maxItemRadius + avgCollisionRadius + PADDING)

  // Create force simulation
  const simulation = d3.forceSimulation(nodes)
    .force('collide', d3.forceCollide<SimNode>()
      .radius(d => d.collisionRadius)
      .strength(0.8)
      .iterations(2)
    )
    .force('radial', d3.forceRadial<SimNode>(targetRadius * 0.3, 0, 0).strength(0.05))
    .force('boundary', forceCircularBoundary(nodes, targetRadius))
    .alphaDecay(0.02) // Slower decay for better convergence
    .stop()

  // Run simulation to completion
  for (let i = 0; i < 400; i++) {
    simulation.tick()
  }

  // Calculate actual enclosing circle from final positions
  let maxRadius = 0
  const positions: { item: FileSystemItem, x: number, y: number }[] = []

  for (const node of nodes) {
    const x = node.x || 0
    const y = node.y || 0
    const halfW = node.width / 2
    const halfH = ITEM_HEIGHT / 2

    // Check all corners to find max distance from center
    const corners = [
      Math.sqrt((x - halfW) ** 2 + (y - halfH) ** 2),
      Math.sqrt((x + halfW) ** 2 + (y - halfH) ** 2),
      Math.sqrt((x - halfW) ** 2 + (y + halfH) ** 2),
      Math.sqrt((x + halfW) ** 2 + (y + halfH) ** 2)
    ]
    maxRadius = Math.max(maxRadius, ...corners)

    positions.push({ item: node.item, x, y })
  }

  return { positions, radius: maxRadius + PADDING }
}

// Export radius calculation so TreeView can use it for spacing
export function calculateRadius(itemCount: number, items?: FileSystemItem[]): number {
  if (itemCount === 0) return 0
  if (items) {
    const { radius } = layoutCircular(items)
    return radius
  }
  if (itemCount === 1) return 100
  return Math.max(80, 30 + itemCount * 20)
}

// Memoized GroupCircle to prevent re-renders during zoom/pan
const GroupCircle = memo(function GroupCircle({ label, items, cx, cy, isFolder, expandedPaths, onItemClick }: GroupCircleProps) {
  if (items.length === 0) return null

  const strokeColor = isFolder ? '#00f0ff' : '#bf00ff'
  // Use CSS class for glow instead of inline filter for better performance
  const glowClass = isFolder ? 'group-glow-cyan' : 'group-glow-purple'

  const { nodePositions, radius } = useMemo(() => {
    const { positions, radius } = layoutCircular(items)

    // Map to final screen positions (offset down slightly for label)
    const nodePositions = positions.map(p => ({
      item: p.item,
      x: cx + p.x,
      y: cy + 8 + p.y
    }))

    return { nodePositions, radius }
  }, [items, cx, cy])

  // Memoize click handlers to prevent re-creation
  const handleItemClick = useCallback((item: FileSystemItem) => {
    onItemClick(item)
  }, [onItemClick])

  return (
    <g className={glowClass}>
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="transparent"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeDasharray="8 4"
        opacity={0.6}
      />

      <text
        x={cx}
        y={cy - radius + 16}
        textAnchor="middle"
        fill={strokeColor}
        fontSize={11}
        fontFamily="'JetBrains Mono', monospace"
        fontWeight="500"
        opacity={0.8}
      >
        {label}
      </text>

      {nodePositions.map(({ item, x, y }) => (
        <TreeNode
          key={item.path}
          item={item}
          x={x}
          y={y}
          isExpanded={expandedPaths.has(item.path)}
          onClick={() => handleItemClick(item)}
        />
      ))}
    </g>
  )
})

export default GroupCircle
