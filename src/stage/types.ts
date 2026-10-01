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
  /**
   * The near plane follows the camera: this fraction of its distance to the target,
   * never below `near`. A fixed near plane far below the camera's working distance
   * wastes the depth buffer, and close surfaces (land and sea, runway and apron) fight.
   */
  nearFrac?: number
}

export type Quality = 'high' | 'medium' | 'low'

/** How a stage is lit: the studio miniature, or a world scene with its own sun and sky. */
export type Scenery = 'studio' | 'world'
