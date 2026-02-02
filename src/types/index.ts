export interface FileSystemItem {
  name: string
  type: 'folder' | 'file'
  path: string
}

export type DataSource = 'node' | 'gateway'

export interface Point {
  x: number
  y: number
}

export interface TreeNodeData extends FileSystemItem {
  x: number
  y: number
  children?: TreeNodeData[]
}

// === Spatial Layout Types ===

/**
 * Represents a direction for positioning child nodes relative to parent
 * Angle in radians: 0 = right, PI/2 = down, PI = left, 3*PI/2 = up
 */
export interface Direction {
  name: string
  angle: number  // Radians from positive X axis (clockwise, SVG coordinates)
  priority: number  // Lower = higher priority (try first)
}

/**
 * Represents an occupied circular region in the layout space
 */
export interface OccupiedRegion {
  cx: number
  cy: number
  radius: number
  path: string  // The folder path that owns this region
  type: 'folder-group' | 'file-group' | 'root'
}

/**
 * Constraints for spatial layout calculations
 */
export interface LayoutConstraints {
  minDistance: number  // Minimum distance between parent and child centers
  maxDistance: number  // Maximum distance (proximity constraint)
  gapBetweenGroups: number  // Minimum gap between sibling group circles
  viewportPadding: number  // Padding from viewport edges
}

/**
 * Result of a spatial position calculation
 */
export interface SpatialPosition {
  x: number
  y: number
  direction: Direction
  isValid: boolean  // Whether the position is within bounds and collision-free
}

/**
 * Viewport dimensions for boundary detection
 */
export interface ViewportBounds {
  width: number
  height: number
  // Current transform state
  translateX: number
  translateY: number
  scale: number
}

/**
 * Configuration for the spatial layout manager
 */
export interface SpatialLayoutConfig {
  constraints: LayoutConstraints
  directions: Direction[]
}