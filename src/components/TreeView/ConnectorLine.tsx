interface ConnectorLineProps {
  fromX: number
  fromY: number
  toX: number
  toY: number
  isFolder: boolean
  targetRadius?: number  // Circle radius to stop at edge
  sourceRadius?: number  // Source circle radius to start from edge
}

export default function ConnectorLine({ fromX, fromY, toX, toY, isFolder, targetRadius = 0, sourceRadius = 0 }: ConnectorLineProps) {
  const strokeColor = isFolder ? '#00f0ff' : '#bf00ff'

  // Calculate the direction vector from source to target
  const dx = toX - fromX
  const dy = toY - fromY
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Normalized direction
  const ndx = distance > 0 ? dx / distance : 0
  const ndy = distance > 0 ? dy / distance : 1

  // Calculate start point at source circle edge
  let startX = fromX
  let startY = fromY
  if (sourceRadius > 0 && distance > 0) {
    startX = fromX + ndx * sourceRadius
    startY = fromY + ndy * sourceRadius
  }

  // Calculate endpoint at target circle edge
  let endX = toX
  let endY = toY
  if (targetRadius > 0 && distance > 0) {
    endX = toX - ndx * targetRadius
    endY = toY - ndy * targetRadius
  }

  // Calculate control points for smooth bezier curve
  // Adjust control points based on direction for smooth curves
  const effectiveDx = endX - startX
  const effectiveDy = endY - startY

  // Determine curve style based on primary direction
  const isMoreVertical = Math.abs(effectiveDy) > Math.abs(effectiveDx)

  let controlOffset: number
  let path: string

  if (isMoreVertical) {
    // Primarily vertical: use vertical-first curve
    controlOffset = effectiveDy / 2
    path = `M ${startX} ${startY} C ${startX} ${startY + controlOffset}, ${endX} ${endY - controlOffset}, ${endX} ${endY}`
  } else {
    // Primarily horizontal: use horizontal-first curve
    controlOffset = effectiveDx / 2
    path = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`
  }

  return (
    <path
      d={path}
      fill="none"
      stroke={strokeColor}
      strokeWidth={2}
      opacity={0.5}
      style={{ filter: `drop-shadow(0 0 4px ${strokeColor}40)` }}
    />
  )
}
