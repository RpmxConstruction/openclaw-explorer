import { useRef, useEffect, useCallback, useMemo } from 'react'
import * as d3 from 'd3'
import { FileSystemItem } from '../../types'
import GroupCircle, { calculateRadius } from './GroupCircle'
import ConnectorLine from './ConnectorLine'
import TreeNode from './TreeNode'
import { SpatialLayoutManager } from './SpatialLayoutManager'

// Neon color palette for folder identification
// EXCLUDED: #00f0ff (default folder cyan) and #bf00ff (default file purple)
const NEON_COLORS = [
  '#ff00ff', // magenta
  '#00ff88', // green
  '#ff6600', // orange
  '#ffff00', // yellow
  '#ff0066', // pink
  '#ff3399', // hot pink
  '#66ff00', // lime
  '#9933ff', // violet
  '#ff9900', // amber
  '#33ff99', // mint
  '#ff0099', // rose
  '#ccff00', // chartreuse
  '#ff5555', // coral red
  '#00ffcc', // turquoise
  '#ffaa00', // gold
]

interface TreeViewProps {
  rootItems: FileSystemItem[]
  expandedPaths: Set<string>
  childrenMap: Map<string, FileSystemItem[]>
  onExpand: (path: string) => void
  onFileClick: (path: string) => void
  onReset: () => void
  lastExpandedPath: string | null
}

export default function TreeView({ rootItems, expandedPaths, childrenMap, onExpand, onFileClick, onReset, lastExpandedPath }: TreeViewProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const isInteractingRef = useRef(false)

  // Create a stable SpatialLayoutManager instance
  const layoutManagerRef = useRef<SpatialLayoutManager>(new SpatialLayoutManager())

  // Track assigned colors for expanded folders using useMemo to ensure all expanded folders have colors
  // This ensures colors are assigned consistently whenever expandedPaths changes
  const folderColors = useMemo(() => {
    const colorMap = new Map<string, string>()
    let colorIndex = 0

    // Assign colors to all expanded folders in a deterministic order
    // Sort the paths to ensure consistent color assignment
    const sortedExpandedPaths = Array.from(expandedPaths).sort()

    console.log('Assigning colors to expanded paths:', sortedExpandedPaths)

    for (const folderPath of sortedExpandedPaths) {
      if (!colorMap.has(folderPath)) {
        const color = NEON_COLORS[colorIndex % NEON_COLORS.length]
        console.log(`Assigning color ${color} to folder ${folderPath}`)
        colorMap.set(folderPath, color)
        colorIndex++
      }
    }

    console.log('Final folderColors map:', Array.from(colorMap.entries()))
    return colorMap
  }, [expandedPaths])

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return

    const svg = d3.select(svgRef.current)
    const g = d3.select(gRef.current)

    // Direct DOM manipulation for 120fps performance - bypasses React reconciliation
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('start', () => {
        isInteractingRef.current = true
        // Add performance class during interaction
        gRef.current?.classList.add('is-zooming')
      })
      .on('zoom', (event) => {
        // Direct attribute manipulation - no React re-render
        g.attr('transform', event.transform.toString())
      })
      .on('end', () => {
        isInteractingRef.current = false
        // Remove performance class after interaction
        gRef.current?.classList.remove('is-zooming')
      })

    zoomRef.current = zoom
    svg.call(zoom)

    // Set initial transform centered horizontally, with some top padding
    const rect = svgRef.current.getBoundingClientRect()
    const initialTransform = d3.zoomIdentity.translate(rect.width / 2, 100)
    svg.call(zoom.transform, initialTransform)

    return () => { svg.on('.zoom', null) }
  }, [])
  
  useEffect(() => {
    if (!svgRef.current || !gRef.current || !zoomRef.current || !lastExpandedPath) return
    
    const timeoutId = setTimeout(() => {
      const svg = d3.select(svgRef.current!)
      const newLevelGroup = gRef.current!.querySelector(`[data-expanded-from="${CSS.escape(lastExpandedPath)}"]`) as SVGGElement | null
      
      if (!newLevelGroup) {
        const g = gRef.current!
        const bbox = g.getBBox()
        const rect = svgRef.current!.getBoundingClientRect()
        if (bbox.width === 0 || bbox.height === 0) return
        const padding = 80
        const scale = Math.min(
          (rect.width - padding * 2) / bbox.width,
          (rect.height - padding * 2) / bbox.height,
          1.5
        )
        const centerX = bbox.x + bbox.width / 2
        const centerY = bbox.y + bbox.height / 2
        const translateX = rect.width / 2 - centerX * scale
        const translateY = rect.height / 2 - centerY * scale
        svg.transition().duration(500).ease(d3.easeCubicOut).call(
          zoomRef.current!.transform,
          d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        )
        return
      }
      
      const bbox = newLevelGroup.getBBox()
      const rect = svgRef.current!.getBoundingClientRect()
      
      if (bbox.width === 0 || bbox.height === 0) return
      
      const padding = 100
      const scale = Math.min(
        (rect.width - padding * 2) / bbox.width,
        (rect.height - padding * 2) / bbox.height,
        1.2
      )
      
      const centerX = bbox.x + bbox.width / 2
      const centerY = bbox.y + bbox.height / 2
      const translateX = rect.width / 2 - centerX * scale
      const translateY = rect.height / 2 - centerY * scale
      
      svg.transition()
        .duration(500)
        .ease(d3.easeCubicOut)
        .call(
          zoomRef.current!.transform,
          d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        )
    }, 50)
    
    return () => clearTimeout(timeoutId)
  }, [lastExpandedPath])
  
  const handleItemClick = useCallback((item: FileSystemItem) => {
    if (item.type === 'folder') {
      onExpand(item.path)
    } else {
      onFileClick(item.path)
    }
  }, [onExpand, onFileClick])
  
  const rootFolders = rootItems.filter(i => i.type === 'folder')
  const rootFiles = rootItems.filter(i => i.type === 'file')

  const folderRadius = calculateRadius(rootFolders.length, rootFolders)
  const fileRadius = calculateRadius(rootFiles.length, rootFiles)

  const rootY = 60
  const groupY = 200 + Math.max(folderRadius, fileRadius)

  const hasBoth = rootFolders.length > 0 && rootFiles.length > 0
  const gap = 60
  const folderGroupX = hasBoth ? -(folderRadius + gap / 2) : 0
  const fileGroupX = hasBoth ? (fileRadius + gap / 2) : 0

  // Memoize layout manager operations
  const layoutManager = layoutManagerRef.current

  // Create a lookup map for folder items by path
  const folderByPath = useMemo(() => {
    const map = new Map<string, FileSystemItem>()
    // Add root folders
    for (const folder of rootFolders) {
      map.set(folder.path, folder)
    }
    // Add all folders from childrenMap
    for (const children of childrenMap.values()) {
      for (const child of children) {
        if (child.type === 'folder') {
          map.set(child.path, child)
        }
      }
    }
    return map
  }, [rootFolders, childrenMap])

  // Pre-calculated positions for all expanded nodes
  // This is computed in a single pass to ensure collision detection works correctly
  interface CalculatedPosition {
    parentPath: string
    folderX: number
    folderY: number
    fileX: number
    fileY: number
    folderRadius: number
    fileRadius: number
    hasFolders: boolean
    hasFiles: boolean
    folders: FileSystemItem[]
    files: FileSystemItem[]
  }

  // Calculate all positions upfront in a single pass
  const calculatedPositions = useMemo(() => {
    layoutManager.clearRegions()
    const positions = new Map<string, CalculatedPosition>()

    // Register root groups as occupied regions
    if (rootFolders.length > 0) {
      layoutManager.registerRegion({
        cx: folderGroupX,
        cy: groupY,
        radius: folderRadius,
        path: 'root/folders',
        type: 'folder-group'
      })
    }
    if (rootFiles.length > 0) {
      layoutManager.registerRegion({
        cx: fileGroupX,
        cy: groupY,
        radius: fileRadius,
        path: 'root/files',
        type: 'file-group'
      })
    }

    // Recursive function to calculate positions for all expanded folders
    function calculatePositionsRecursive(
      parentPath: string,
      parentX: number,
      parentY: number,
      parentRadius: number
    ): void {
      const children = childrenMap.get(parentPath)
      if (!children || !expandedPaths.has(parentPath)) return

      const folders = children.filter(c => c.type === 'folder')
      const files = children.filter(c => c.type === 'file')

      if (folders.length === 0 && files.length === 0) return

      const childFolderRadius = calculateRadius(folders.length, folders)
      const childFileRadius = calculateRadius(files.length, files)
      const maxChildRadius = Math.max(childFolderRadius, childFileRadius, 80)

      // Use spatial layout manager to find optimal positions
      const { folderPosition, filePosition } = layoutManager.findPositionsForChildren(
        parentPath,
        parentX,
        parentY,
        parentRadius,
        childFolderRadius,
        childFileRadius,
        folders.length > 0,
        files.length > 0
      )

      // Calculate actual positions with fallbacks
      let folderX = parentX
      let fileX = parentX
      let folderY = parentY + parentRadius + 80 + maxChildRadius
      let fileY = folderY

      if (folderPosition) {
        folderX = folderPosition.x
        folderY = folderPosition.y
        // Register the folder group region IMMEDIATELY so siblings see it
        layoutManager.registerRegion({
          cx: folderX,
          cy: folderY,
          radius: childFolderRadius,
          path: `${parentPath}/folders`,
          type: 'folder-group'
        })
      }

      if (filePosition) {
        fileX = filePosition.x
        fileY = filePosition.y
        // Register the file group region IMMEDIATELY so siblings see it
        layoutManager.registerRegion({
          cx: fileX,
          cy: fileY,
          radius: childFileRadius,
          path: `${parentPath}/files`,
          type: 'file-group'
        })
      }

      // Store calculated position
      positions.set(parentPath, {
        parentPath,
        folderX,
        folderY,
        fileX,
        fileY,
        folderRadius: childFolderRadius,
        fileRadius: childFileRadius,
        hasFolders: folders.length > 0,
        hasFiles: files.length > 0,
        folders,
        files
      })

      // Recursively calculate for expanded child folders
      for (const folder of folders) {
        if (expandedPaths.has(folder.path)) {
          calculatePositionsRecursive(
            folder.path,
            folderX,
            folderY,
            childFolderRadius
          )
        }
      }
    }

    // Calculate positions for all expanded root folders
    for (const folder of rootFolders) {
      if (expandedPaths.has(folder.path)) {
        calculatePositionsRecursive(folder.path, folderGroupX, groupY, folderRadius)
      }
    }

    return positions
  }, [expandedPaths, childrenMap, folderGroupX, fileGroupX, groupY, folderRadius, fileRadius, rootFolders])

  // Render function now just uses pre-calculated positions
  function renderExpandedChildren(
    parentPath: string,
    parentX: number,
    parentY: number,
    parentRadius: number,
    depth: number
  ): JSX.Element[] {
    const pos = calculatedPositions.get(parentPath)
    if (!pos) return []

    const { folderX, folderY, fileX, fileY, folderRadius: childFolderRadius, fileRadius: childFileRadius,
            hasFolders, hasFiles, folders, files } = pos

    const elements: JSX.Element[] = []
    const isLastExpanded = parentPath === lastExpandedPath
    const innerElements: JSX.Element[] = []

    // Get the assigned color for this parent folder
    const parentColor = folderColors.get(parentPath)
    console.log(`renderExpandedChildren: parentPath=${parentPath}, parentColor=${parentColor}, folderColors size=${folderColors.size}`)
    // Find the parent folder item to render it at the connector origin
    const parentFolderItem = folderByPath.get(parentPath)

    // Calculate the direction from parent center toward children
    // If we have both folders and files, use the midpoint; otherwise use the single target
    let targetX: number, targetY: number
    let childRadius: number
    if (hasFolders && hasFiles) {
      targetX = (folderX + fileX) / 2
      targetY = (folderY + fileY) / 2
      childRadius = Math.max(childFolderRadius, childFileRadius)
    } else if (hasFolders) {
      targetX = folderX
      targetY = folderY
      childRadius = childFolderRadius
    } else {
      targetX = fileX
      targetY = fileY
      childRadius = childFileRadius
    }

    // Calculate direction vector from parent center to target
    const dx = targetX - parentX
    const dy = targetY - parentY
    const distanceToChild = Math.sqrt(dx * dx + dy * dy)

    // Normalized direction
    const ndx = distanceToChild > 0 ? dx / distanceToChild : 0
    const ndy = distanceToChild > 0 ? dy / distanceToChild : 1

    // Folder node dimensions - use half the height as radius (since it's a rounded rect)
    const folderNodeHeight = 36
    const folderNodeRadius = folderNodeHeight / 2  // Use half height for rounded rect edges

    // Calculate the midpoint between parent edge and child edge for equidistant positioning
    // Parent edge is at: parentRadius from parent center
    // Child edge is at: distanceToChild - childRadius from parent center
    // Midpoint = (parentRadius + (distanceToChild - childRadius)) / 2
    const parentEdgeDist = parentRadius
    const childEdgeDist = distanceToChild - childRadius
    const midpointDist = (parentEdgeDist + childEdgeDist) / 2

    // Position folder node center at the midpoint
    const folderNodeX = parentX + ndx * midpointDist
    const folderNodeY = parentY + ndy * midpointDist

    // Connector from parent circle edge to folder node edge (straight line for short distance)
    innerElements.push(
      <ConnectorLine
        key={`line-${parentPath}-to-node`}
        fromX={parentX}
        fromY={parentY}
        toX={folderNodeX}
        toY={folderNodeY}
        isFolder={true}
        sourceRadius={parentRadius}
        targetRadius={folderNodeRadius}
        color={parentColor}
        straight={true}
      />
    )

    // Render the parent folder node
    if (parentFolderItem) {
      innerElements.push(
        <TreeNode
          key={`parent-node-${parentPath}`}
          item={parentFolderItem}
          x={folderNodeX}
          y={folderNodeY}
          isExpanded={true}
          onClick={() => handleItemClick(parentFolderItem)}
          expandedColor={parentColor}
        />
      )
    }

    if (hasFolders) {
      // Connector from folder node to child folders circle
      innerElements.push(
        <ConnectorLine
          key={`line-${parentPath}-folders`}
          fromX={folderNodeX}
          fromY={folderNodeY}
          toX={folderX}
          toY={folderY}
          isFolder={true}
          sourceRadius={folderNodeRadius}
          targetRadius={childFolderRadius}
          color={parentColor}
        />
      )
      innerElements.push(
        <GroupCircle
          key={`group-${parentPath}-folders`}
          label="FOLDERS"
          items={folders}
          cx={folderX}
          cy={folderY}
          isFolder={true}
          expandedPaths={expandedPaths}
          onItemClick={handleItemClick}
          folderColors={folderColors}
        />
      )
    }

    if (hasFiles) {
      // Connector from folder node to child files circle
      innerElements.push(
        <ConnectorLine
          key={`line-${parentPath}-files`}
          fromX={folderNodeX}
          fromY={folderNodeY}
          toX={fileX}
          toY={fileY}
          isFolder={false}
          sourceRadius={folderNodeRadius}
          targetRadius={childFileRadius}
          color={parentColor}
        />
      )
      innerElements.push(
        <GroupCircle
          key={`group-${parentPath}-files`}
          label="FILES"
          items={files}
          cx={fileX}
          cy={fileY}
          isFolder={false}
          expandedPaths={expandedPaths}
          onItemClick={handleItemClick}
          folderColors={folderColors}
        />
      )
    }

    if (isLastExpanded) {
      elements.push(
        <g key={`expanded-wrapper-${parentPath}`} data-expanded-from={parentPath}>
          {innerElements}
        </g>
      )
    } else {
      elements.push(...innerElements)
    }

    // Recursively render children of expanded folders
    for (const folder of folders) {
      if (expandedPaths.has(folder.path)) {
        elements.push(...renderExpandedChildren(
          folder.path,
          folderX,
          folderY,
          childFolderRadius,
          depth + 1
        ))
      }
    }

    return elements
  }

  // For expanded root folders, use the group center as the connection point
  const expandedElements: JSX.Element[] = []
  for (const folder of rootFolders) {
    if (expandedPaths.has(folder.path)) {
      // Use the folder group center as the parent position, pass the root folder group radius
      expandedElements.push(...renderExpandedChildren(folder.path, folderGroupX, groupY, folderRadius, 1))
    }
  }
  
  return (
    <svg ref={svgRef} className="w-full h-full tree-view-svg" style={{ cursor: 'grab' }}>
      <g ref={gRef} className="tree-view-content">
        {/* Root indicator with pulsing green circle - clickable to reset */}
        <g
          onClick={onReset}
          style={{ cursor: 'pointer' }}
          className="root-indicator"
        >
          {/* Pulsing background circle */}
          <circle
            cx={0}
            cy={rootY - 35}
            r={28}
            fill="#00ff88"
            stroke="#00ff88"
            strokeWidth={2}
            style={{
              animation: 'root-pulse 3s ease-in-out infinite',
              transformOrigin: '0px ' + (rootY - 35) + 'px',
            }}
          />
          <text x={0} y={rootY - 30} textAnchor="middle" fill="#00f0ff" fontSize={16} fontWeight="bold" fontFamily="'JetBrains Mono', monospace" className="glow-cyan">ROOT</text>
        </g>
        
        {rootFolders.length > 0 && (
          <ConnectorLine 
            fromX={0} 
            fromY={rootY} 
            toX={folderGroupX} 
            toY={groupY} 
            isFolder={true} 
            targetRadius={folderRadius}
          />
        )}
        {rootFiles.length > 0 && (
          <ConnectorLine 
            fromX={0} 
            fromY={rootY} 
            toX={fileGroupX} 
            toY={groupY} 
            isFolder={false} 
            targetRadius={fileRadius}
          />
        )}
        
        {rootFolders.length > 0 && (
          <GroupCircle
            label="FOLDERS"
            items={rootFolders}
            cx={folderGroupX}
            cy={groupY}
            isFolder={true}
            expandedPaths={expandedPaths}
            onItemClick={handleItemClick}
            folderColors={folderColors}
          />
        )}
        {rootFiles.length > 0 && (
          <GroupCircle
            label="FILES"
            items={rootFiles}
            cx={fileGroupX}
            cy={groupY}
            isFolder={false}
            expandedPaths={expandedPaths}
            onItemClick={handleItemClick}
            folderColors={folderColors}
          />
        )}
        
        {expandedElements}
      </g>
    </svg>
  )
}
