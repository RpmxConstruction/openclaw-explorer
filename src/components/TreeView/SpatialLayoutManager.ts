import {
  Direction,
  OccupiedRegion,
  LayoutConstraints,
  SpatialPosition,
  ViewportBounds,
  SpatialLayoutConfig
} from '../../types'

// Default directions in priority order (clockwise from bottom)
// SVG coordinates: Y increases downward
export const DEFAULT_DIRECTIONS: Direction[] = [
  { name: 'below', angle: Math.PI / 2, priority: 0 },           // 90° - straight down (most natural for tree)
  { name: 'below-right', angle: Math.PI / 4, priority: 1 },     // 45° - diagonal down-right
  { name: 'below-left', angle: 3 * Math.PI / 4, priority: 2 },  // 135° - diagonal down-left
  { name: 'right', angle: 0, priority: 3 },                      // 0° - straight right
  { name: 'left', angle: Math.PI, priority: 4 },                 // 180° - straight left
  { name: 'above-right', angle: -Math.PI / 4, priority: 5 },    // -45° - diagonal up-right
  { name: 'above-left', angle: -3 * Math.PI / 4, priority: 6 }, // -135° - diagonal up-left
  { name: 'above', angle: -Math.PI / 2, priority: 7 },          // -90° - straight up (least natural)
]

export const DEFAULT_CONSTRAINTS: LayoutConstraints = {
  minDistance: 100,      // Minimum gap between parent edge and child edge
  maxDistance: 400,      // Maximum distance to keep parent-child relationship clear
  gapBetweenGroups: 40,  // Minimum gap between group circles
  viewportPadding: 50,   // Padding from screen edges
}

/**
 * SpatialLayoutManager handles intelligent positioning of expanded folder children
 * to prevent overlap and maintain visual clarity in the tree visualization.
 */
export class SpatialLayoutManager {
  private occupiedRegions: Map<string, OccupiedRegion[]> = new Map()
  private folderDirections: Map<string, Direction> = new Map()
  private config: SpatialLayoutConfig
  private viewport: ViewportBounds | null = null

  constructor(config?: Partial<SpatialLayoutConfig>) {
    this.config = {
      constraints: config?.constraints || DEFAULT_CONSTRAINTS,
      directions: config?.directions || DEFAULT_DIRECTIONS,
    }
  }

  /**
   * Update the viewport bounds for boundary detection
   */
  setViewport(bounds: ViewportBounds): void {
    this.viewport = bounds
  }

  /**
   * Register an occupied region (call this for each rendered group)
   */
  registerRegion(region: OccupiedRegion): void {
    const parentPath = this.getParentPath(region.path)
    if (!this.occupiedRegions.has(parentPath)) {
      this.occupiedRegions.set(parentPath, [])
    }
    // Remove existing region for same path if any
    const regions = this.occupiedRegions.get(parentPath)!
    const existingIndex = regions.findIndex(r => r.path === region.path)
    if (existingIndex >= 0) {
      regions[existingIndex] = region
    } else {
      regions.push(region)
    }
  }

  /**
   * Clear all registered regions (call on tree reset/collapse all)
   */
  clearRegions(): void {
    this.occupiedRegions.clear()
  }

  /**
   * Clear direction assignments (call on tree reset)
   */
  clearDirections(): void {
    this.folderDirections.clear()
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.clearRegions()
    this.clearDirections()
  }

  /**
   * Get the assigned direction for a folder, or null if not yet assigned
   */
  getAssignedDirection(folderPath: string): Direction | null {
    return this.folderDirections.get(folderPath) || null
  }

  /**
   * Get all regions under a parent path (siblings)
   */
  getSiblingRegions(parentPath: string): OccupiedRegion[] {
    return this.occupiedRegions.get(parentPath) || []
  }

  /**
   * Get all occupied regions across all parents
   */
  getAllRegions(): OccupiedRegion[] {
    const all: OccupiedRegion[] = []
    for (const regions of this.occupiedRegions.values()) {
      all.push(...regions)
    }
    return all
  }

  /**
   * Check if two circular regions collide
   */
  checkCircleCollision(
    cx1: number, cy1: number, r1: number,
    cx2: number, cy2: number, r2: number,
    gap: number = 0
  ): boolean {
    const dx = cx2 - cx1
    const dy = cy2 - cy1
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance < (r1 + r2 + gap)
  }

  /**
   * Check if a position would collide with any existing region
   */
  checkCollisionWithExisting(cx: number, cy: number, radius: number): boolean {
    const gap = this.config.constraints.gapBetweenGroups
    for (const region of this.getAllRegions()) {
      if (this.checkCircleCollision(cx, cy, radius, region.cx, region.cy, region.radius, gap)) {
        return true
      }
    }
    return false
  }

  /**
   * Extract parent path from a full path
   */
  private getParentPath(path: string): string {
    const lastSlash = path.lastIndexOf('/')
    if (lastSlash <= 0) return 'root'
    return path.substring(0, lastSlash)
  }

  /**
   * Check if a position is within viewport bounds
   */
  checkViewportBounds(cx: number, cy: number, radius: number): boolean {
    if (!this.viewport) return true // No viewport set, assume valid

    const padding = this.config.constraints.viewportPadding
    const { width, height, translateX, translateY, scale } = this.viewport

    // Convert world coordinates to screen coordinates
    const screenX = cx * scale + translateX
    const screenY = cy * scale + translateY
    const screenRadius = radius * scale

    // Check if the circle would be fully visible
    return (
      screenX - screenRadius >= padding &&
      screenX + screenRadius <= width - padding &&
      screenY - screenRadius >= padding &&
      screenY + screenRadius <= height - padding
    )
  }

  /**
   * Calculate position for children in a given direction
   */
  calculatePositionInDirection(
    parentX: number,
    parentY: number,
    parentRadius: number,
    childRadius: number,
    direction: Direction
  ): { x: number; y: number } {
    const { minDistance } = this.config.constraints

    // Distance from parent center to child center
    // = parentRadius + gap + childRadius
    const distance = parentRadius + minDistance + childRadius

    const x = parentX + Math.cos(direction.angle) * distance
    const y = parentY + Math.sin(direction.angle) * distance

    return { x, y }
  }

  /**
   * Find the best position for children of a folder
   * Returns position and direction, considering:
   * - Previously assigned direction (for consistency)
   * - Collision with existing regions
   * - Viewport bounds
   */
  findBestPosition(
    folderPath: string,
    parentX: number,
    parentY: number,
    parentRadius: number,
    childRadius: number
  ): SpatialPosition {
    // Check if this folder already has an assigned direction
    const existingDirection = this.folderDirections.get(folderPath)

    if (existingDirection) {
      const pos = this.calculatePositionInDirection(
        parentX, parentY, parentRadius, childRadius, existingDirection
      )
      // Still use existing direction for consistency, but mark if invalid
      const hasCollision = this.checkCollisionWithExisting(pos.x, pos.y, childRadius)
      const inBounds = this.checkViewportBounds(pos.x, pos.y, childRadius)

      return {
        x: pos.x,
        y: pos.y,
        direction: existingDirection,
        isValid: !hasCollision && inBounds
      }
    }

    // Sort directions by priority
    const sortedDirections = [...this.config.directions].sort((a, b) => a.priority - b.priority)

    // Try each direction until we find one that works
    for (const direction of sortedDirections) {
      const pos = this.calculatePositionInDirection(
        parentX, parentY, parentRadius, childRadius, direction
      )

      const hasCollision = this.checkCollisionWithExisting(pos.x, pos.y, childRadius)
      const inBounds = this.checkViewportBounds(pos.x, pos.y, childRadius)

      if (!hasCollision && inBounds) {
        // Found a valid position - assign this direction to the folder
        this.folderDirections.set(folderPath, direction)
        return {
          x: pos.x,
          y: pos.y,
          direction,
          isValid: true
        }
      }
    }

    // No valid position found - use the first direction and mark as invalid
    // This indicates viewport zoom-out may be needed
    const fallbackDirection = sortedDirections[0]
    const pos = this.calculatePositionInDirection(
      parentX, parentY, parentRadius, childRadius, fallbackDirection
    )

    // Still assign the direction for consistency
    this.folderDirections.set(folderPath, fallbackDirection)

    return {
      x: pos.x,
      y: pos.y,
      direction: fallbackDirection,
      isValid: false
    }
  }

  /**
   * Calculate position for both folder and file groups of expanded children
   * Handles the case where a folder has both folders and files as children
   */
  findPositionsForChildren(
    parentPath: string,
    parentX: number,
    parentY: number,
    parentRadius: number,
    folderGroupRadius: number,
    fileGroupRadius: number,
    hasFolders: boolean,
    hasFiles: boolean
  ): { folderPosition: SpatialPosition | null; filePosition: SpatialPosition | null } {
    const result: { folderPosition: SpatialPosition | null; filePosition: SpatialPosition | null } = {
      folderPosition: null,
      filePosition: null
    }

    if (!hasFolders && !hasFiles) return result

    // Get or determine the primary direction for this parent's children
    const existingDirection = this.folderDirections.get(parentPath)

    if (hasFolders && hasFiles) {
      // Both groups - position them side by side in the assigned direction
      // Try each direction until we find one where BOTH positions are collision-free
      const sortedDirections = [...this.config.directions].sort((a, b) => a.priority - b.priority)

      let bestDirection: Direction | null = null
      let bestPositions: { folder: { x: number; y: number }; file: { x: number; y: number } } | null = null

      // If there's an existing direction, try it first but still check for collisions
      const directionsToTry = existingDirection
        ? [existingDirection, ...sortedDirections.filter(d => d.name !== existingDirection.name)]
        : sortedDirections

      // Find best direction where both groups fit without collision
      for (const direction of directionsToTry) {
        const positions = this.calculateSideBySidePositions(
          parentX, parentY, parentRadius,
          folderGroupRadius, fileGroupRadius,
          direction
        )

        const folderCollides = this.checkCollisionWithExisting(positions.folder.x, positions.folder.y, folderGroupRadius)
        const fileCollides = this.checkCollisionWithExisting(positions.file.x, positions.file.y, fileGroupRadius)

        if (!folderCollides && !fileCollides) {
          bestDirection = direction
          bestPositions = positions
          break
        }
      }

      // Fallback to first direction if none found (all directions have collisions)
      if (!bestDirection) {
        bestDirection = directionsToTry[0]
        bestPositions = this.calculateSideBySidePositions(
          parentX, parentY, parentRadius,
          folderGroupRadius, fileGroupRadius,
          bestDirection
        )
      }

      // Update direction assignment
      this.folderDirections.set(parentPath, bestDirection)

      if (bestPositions && bestDirection) {
        result.folderPosition = {
          ...bestPositions.folder,
          direction: bestDirection,
          isValid: !this.checkCollisionWithExisting(bestPositions.folder.x, bestPositions.folder.y, folderGroupRadius)
        }
        result.filePosition = {
          ...bestPositions.file,
          direction: bestDirection,
          isValid: !this.checkCollisionWithExisting(bestPositions.file.x, bestPositions.file.y, fileGroupRadius)
        }
      }
    } else if (hasFolders) {
      result.folderPosition = this.findBestPosition(
        parentPath, parentX, parentY, parentRadius, folderGroupRadius
      )
    } else if (hasFiles) {
      result.filePosition = this.findBestPosition(
        parentPath, parentX, parentY, parentRadius, fileGroupRadius
      )
    }

    return result
  }
  /**
   * Calculate side-by-side positions for folder and file groups
   */
  private calculateSideBySidePositions(
    parentX: number,
    parentY: number,
    parentRadius: number,
    folderRadius: number,
    fileRadius: number,
    direction: Direction
  ): { folder: { x: number; y: number }; file: { x: number; y: number } } {
    const { minDistance, gapBetweenGroups } = this.config.constraints
    const maxChildRadius = Math.max(folderRadius, fileRadius)

    // Calculate the main position in the direction
    const distance = parentRadius + minDistance + maxChildRadius
    const mainX = parentX + Math.cos(direction.angle) * distance
    const mainY = parentY + Math.sin(direction.angle) * distance

    // Calculate perpendicular offset for side-by-side placement
    // Each group needs to be offset by its own radius plus half the gap
    // so total distance between centers = folderRadius + gapBetweenGroups/2 + fileRadius + gapBetweenGroups/2
    //                                   = folderRadius + fileRadius + gapBetweenGroups
    const perpAngle = direction.angle + Math.PI / 2
    const folderOffset = folderRadius + gapBetweenGroups / 2
    const fileOffset = fileRadius + gapBetweenGroups / 2

    // Folder on the "left" side (perpendicular negative), file on "right"
    return {
      folder: {
        x: mainX - Math.cos(perpAngle) * folderOffset,
        y: mainY - Math.sin(perpAngle) * folderOffset
      },
      file: {
        x: mainX + Math.cos(perpAngle) * fileOffset,
        y: mainY + Math.sin(perpAngle) * fileOffset
      }
    }
  }

  /**
   * Calculate the required zoom scale to fit all content including a new region
   */
  calculateRequiredScale(
    newCx: number,
    newCy: number,
    newRadius: number,
    currentBBox: { x: number; y: number; width: number; height: number }
  ): number | null {
    if (!this.viewport) return null

    const padding = this.config.constraints.viewportPadding * 2
    const { width: vpWidth, height: vpHeight } = this.viewport

    // Expand bbox to include new region
    const minX = Math.min(currentBBox.x, newCx - newRadius)
    const maxX = Math.max(currentBBox.x + currentBBox.width, newCx + newRadius)
    const minY = Math.min(currentBBox.y, newCy - newRadius)
    const maxY = Math.max(currentBBox.y + currentBBox.height, newCy + newRadius)

    const contentWidth = maxX - minX
    const contentHeight = maxY - minY

    // Calculate scale needed to fit content
    const scaleX = (vpWidth - padding) / contentWidth
    const scaleY = (vpHeight - padding) / contentHeight

    return Math.min(scaleX, scaleY, 1) // Cap at 1x zoom
  }
}

