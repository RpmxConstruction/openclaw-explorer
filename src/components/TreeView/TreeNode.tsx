import { memo } from 'react'
import { FileSystemItem } from '../../types'

interface TreeNodeProps {
  item: FileSystemItem
  x: number
  y: number
  isExpanded?: boolean
  onClick: () => void
}

// Memoized component to prevent unnecessary re-renders during zoom/pan
const TreeNode = memo(function TreeNode({ item, x, y, isExpanded, onClick }: TreeNodeProps) {
  const isFolder = item.type === 'folder'
  const width = Math.max(120, item.name.length * 10 + 40)
  const height = 36

  const strokeColor = isFolder ? '#00f0ff' : '#bf00ff'
  const glowClass = isFolder ? 'glow-cyan-hover' : 'glow-purple-hover'

  // Pre-compute filter style to avoid style recalculation
  const filterStyle = isExpanded
    ? { filter: isFolder ? 'drop-shadow(0 0 12px #00f0ff)' : 'drop-shadow(0 0 12px #bf00ff)' }
    : undefined

  return (
    <g
      transform={`translate(${x - width/2}, ${y - height/2})`}
      onClick={onClick}
      className={`cursor-pointer ${glowClass} tree-node`}
      style={filterStyle}
    >
      <rect
        width={width}
        height={height}
        rx={8}
        fill="#0a0a0f"
        stroke={strokeColor}
        strokeWidth={2}
      />
      <text
        x={width/2}
        y={height/2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#e0e0e0"
        fontSize={12}
        fontFamily="'JetBrains Mono', monospace"
      >
        {isFolder ? 'F ' : 'f '}{item.name}
      </text>
    </g>
  )
})

export default TreeNode