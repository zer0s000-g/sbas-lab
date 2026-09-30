import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Shot } from './types'

/**
 * Drag to look around: mouse and pen orbit around the current shot's target
 * (yaw and a limited pitch); on touch only sideways drags turn the view, so a
 * vertical swipe still scrolls the page. Double-click resets, and a new
 * phase shot starts from the unturned view. No wheel zoom: the stage fills
 * the page background and the wheel must keep scrolling the page.
 */
function useLookAround(shot: Shot) {
  const { gl } = useThree()
  const look = useRef({ yaw: 0, pitch: 0 })
  useEffect(() => {
    look.current = { yaw: 0, pitch: 0 }
  }, [shot])
  useEffect(() => {
    const el = gl.domElement
    el.style.touchAction = 'pan-y'
    let drag: { id: number; x: number; y: number; touch: boolean } | null = null
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch' }
    }
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      if (drag.touch && Math.abs(dy) > Math.abs(dx)) return
      drag.x = e.clientX
      drag.y = e.clientY
      if (!el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
      look.current.yaw -= dx * 0.006
      if (!drag.touch) look.current.pitch = Math.max(-0.3, Math.min(0.35, look.current.pitch + dy * 0.004))
    }
    const up = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) drag = null
      el.style.cursor = ''
    }
    const reset = () => {
      look.current = { yaw: 0, pitch: 0 }
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('dblclick', reset)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('dblclick', reset)
    }
  }, [gl])
  return look
}

/**
 * Eases the camera toward the current shot every frame (snaps when the
 * learner prefers reduced motion). `drift` adds a very slow idle orbit.
 */
export function CameraRig({ shot, drift, reduced }: { shot: Shot; drift: boolean; reduced: boolean }) {
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3(...shot.target))
  const pos = useRef(new THREE.Vector3(...shot.position))
  const first = useRef(true)
  const look = useLookAround(shot)
  const yawNow = useRef(0)
  const pitchNow = useRef(0)
  useLayoutEffect(() => {
    if (first.current || reduced) {
      camera.position.set(...shot.position)
      target.current.set(...shot.target)
      pos.current.set(...shot.position)
      camera.lookAt(target.current)
      first.current = false
    }
  }, [camera, shot, reduced])
  useFrame((state, dt) => {
    const k = reduced ? 1 : 1 - Math.exp(-dt / 0.55)
    const kLook = reduced ? 1 : 1 - Math.exp(-dt / 0.12)
    yawNow.current += (look.current.yaw - yawNow.current) * kLook
    pitchNow.current += (look.current.pitch - pitchNow.current) * kLook
    const tgt = new THREE.Vector3(...shot.target)
    const off = new THREE.Vector3(...shot.position).sub(tgt)
    if (drift && !reduced) {
      // A slow, small orbit around the target keeps the scene alive.
      const a = state.clock.elapsedTime * 0.05
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(a) * 0.08)
    }
    // The learner's drag: yaw about the vertical, pitch about the camera's right axis.
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawNow.current)
    if (pitchNow.current) {
      const right = new THREE.Vector3(0, 1, 0).cross(off).normalize()
      if (right.lengthSq() > 0) off.applyAxisAngle(right, pitchNow.current)
    }
    const want = tgt.clone().add(off)
    pos.current.lerp(want, k)
    target.current.lerp(tgt, k)
    camera.position.copy(pos.current)
    const cam = camera as THREE.PerspectiveCamera
    const fov = shot.fov ?? 30
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov += (fov - cam.fov) * k
      cam.updateProjectionMatrix()
    }
    camera.lookAt(target.current)
  })
  return null
}
