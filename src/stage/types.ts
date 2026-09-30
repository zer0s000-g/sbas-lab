/** Stage types, kept free of three.js so pages can import them without loading the 3D chunk. */
export interface Shot {
  position: [number, number, number]
  target: [number, number, number]
  fov?: number
  /**
   * A moving shot (a chase camera): called every frame for the live position and
   * target. After a shot change the camera eases onto it, then follows it exactly.
   */
  track?: () => { position: [number, number, number]; target: [number, number, number] }
  /** A new value snaps the camera instead of easing (a view with another scale). */
  snapKey?: string
  /** Clip planes for this shot's scene scale. */
  near?: number
  far?: number
}

export type Quality = 'high' | 'medium' | 'low'
