'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'

export type MotionPreset = 'core' | 'cinematic'
export type MotionQuality = 'auto' | 'balanced' | 'high'
export type MotionStrategy = 'geometry' | 'crossfade' | 'presence' | 'none'
export type MotionPhase = 'idle' | 'preview'

export type MotionDiagnostics = {
  readonly phase: MotionPhase
  readonly strategy: MotionStrategy
  readonly totalMarks: number
  readonly animatedMarks: number
  readonly enteringMarks: number
  readonly exitingMarks: number
  readonly cancelledAnimations: number
}

export type MotionBoundaryProps = {
  readonly preset?: MotionPreset
  readonly quality?: MotionQuality
  readonly debug?: boolean
  readonly onDiagnostics?: ((diagnostics: MotionDiagnostics) => void) | undefined
  readonly children: ReactNode
}

type SnapshotRecord = {
  readonly key: string
  readonly element: Element
  readonly tagName: string
  readonly parent: Element | null
  readonly attributes: Readonly<Record<string, string>>
  readonly clone: Element
}

type ActiveAnimations = Map<Element, Set<Animation>>

const MARK_SELECTOR = '[data-shiftcharts-mark-id]'
const OBSERVED_ATTRIBUTES = [
  'data-shiftcharts-mark-id',
  'd',
  'x',
  'y',
  'width',
  'height',
  'cx',
  'cy',
  'r',
  'transform',
  'opacity',
]
const SVG_GEOMETRY_ATTRIBUTES = new Set(['x', 'y', 'width', 'height', 'cx', 'cy', 'r'])

const ANIMATABLE_PROPERTIES: Readonly<Record<string, readonly string[]>> = {
  path: ['d', 'transform', 'opacity'],
  rect: ['x', 'y', 'width', 'height', 'transform', 'opacity'],
  circle: ['cx', 'cy', 'r', 'transform', 'opacity'],
  text: ['x', 'y', 'transform', 'opacity'],
  g: ['transform', 'opacity'],
}

const FALLBACK_PREVIEW_MS = 120
const FALLBACK_SETTLE_MS = 420
const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Opt-in client boundary for interruptible chart motion. It observes only the stable mark seam
 * emitted by primitives; it never resolves a plan, reads data, or changes the chart's semantic
 * geometry. This keeps the premium layer additive rather than a second renderer.
 */
export function MotionBoundary({
  preset = 'core',
  quality = 'auto',
  debug = false,
  onDiagnostics,
  children,
}: MotionBoundaryProps) {
  const boundaryRef = useRef<HTMLDivElement>(null)
  const diagnosticsRef = useRef(onDiagnostics)
  diagnosticsRef.current = onDiagnostics

  useLayoutEffect(() => {
    const boundary = boundaryRef.current
    if (boundary === null || preset !== 'cinematic' || typeof MutationObserver === 'undefined') return
    if (typeof Element.prototype.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    let previous = snapshotMarks(boundary)
    let frame: number | null = null
    let disposed = false
    const active: ActiveAnimations = new Map()

    const publish = (diagnostics: MotionDiagnostics) => {
      if (debug) boundary.dataset.shiftchartsMotionStrategy = diagnostics.strategy
      diagnosticsRef.current?.(diagnostics)
    }

    const reconcile = () => {
      frame = null
      if (disposed) return
      const next = snapshotMarks(boundary)
      const phase = readPhase(boundary)
      const result = animateSnapshot(boundary, previous, next, phase, quality, active)
      publish({ ...result, phase })
      previous = next
    }

    const schedule = () => {
      if (frame !== null || typeof requestAnimationFrame !== 'function') return
      frame = requestAnimationFrame(reconcile)
    }

    const observer = new MutationObserver(schedule)
    observer.observe(boundary, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: OBSERVED_ATTRIBUTES,
    })

    return () => {
      disposed = true
      observer.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
      cancelAll(active)
    }
  }, [preset, quality])

  return (
    <div
      ref={boundaryRef}
      className="shiftcharts-motion-boundary"
      data-shiftcharts-motion-preset={preset}
      data-shiftcharts-motion-quality={quality}
      data-shiftcharts-motion-debug={debug ? '' : undefined}
    >
      {children}
    </div>
  )
}

function snapshotMarks(root: Element): ReadonlyMap<string, SnapshotRecord> {
  const records = new Map<string, SnapshotRecord>()
  for (const element of root.querySelectorAll(MARK_SELECTOR)) {
    const key = element.getAttribute('data-shiftcharts-mark-id')
    if (key === null || records.has(key)) continue
    const attributes: Record<string, string> = {}
    for (const property of ANIMATABLE_PROPERTIES[element.tagName.toLowerCase()] ?? []) {
      const value = element.getAttribute(property)
      if (value !== null) attributes[property] = value
    }
    records.set(key, {
      key,
      element,
      tagName: element.tagName.toLowerCase(),
      parent: element.parentElement,
      attributes,
      clone: element.cloneNode(true) as Element,
    })
  }
  return records
}

function readPhase(root: Element): MotionPhase {
  const source = root.matches('[data-shiftcharts-interaction-phase]')
    ? root
    : root.closest('[data-shiftcharts-interaction-phase]')
      ?? root.parentElement?.closest('[data-shiftcharts-interaction-phase]')
      ?? root.querySelector('[data-shiftcharts-interaction-phase]')
  return source?.getAttribute('data-shiftcharts-interaction-phase') === 'preview' ? 'preview' : 'idle'
}

function animateSnapshot(
  root: Element,
  previous: ReadonlyMap<string, SnapshotRecord>,
  next: ReadonlyMap<string, SnapshotRecord>,
  phase: MotionPhase,
  quality: MotionQuality,
  active: ActiveAnimations,
): Omit<MotionDiagnostics, 'phase'> {
  const duration = durationFor(root, phase, quality)
  let animatedMarks = 0
  let enteringMarks = 0
  let exitingMarks = 0
  let cancelledAnimations = 0
  let strategy: MotionStrategy = 'none'

  for (const [key, current] of next) {
    const old = previous.get(key)
    if (old === undefined || old.tagName !== current.tagName) {
      enteringMarks += 1
      strategy = strategy === 'none' ? 'presence' : strategy
      animatePresence(current.element, duration, active)
      continue
    }

    const properties = ANIMATABLE_PROPERTIES[current.tagName] ?? []
    const isPath = current.tagName === 'path'
    const oldPath = old.attributes.d
    const nextPath = current.attributes.d
    if (isPath && oldPath !== undefined && nextPath !== undefined && !compatiblePath(oldPath, nextPath)) {
      strategy = 'crossfade'
      cancelledAnimations += cancelElementAnimations(current.element, active)
      crossfadePath(current, old, duration, active)
      animatedMarks += 1
      continue
    }

    let animated = false
    for (const property of properties) {
      const from = presentationValue(current.element, property, old.attributes[property], active)
      const to = cssValue(property, current.attributes[property])
      if (from === null || to === null || from === to) continue
      if (property === 'd' && !compatiblePath(from, to)) continue
      cancelledAnimations += cancelAnimationsForProperty(current.element, property, active)
      if (animateProperty(current.element, property, from, to, duration, active)) animated = true
    }
    if (animated) {
      strategy = strategy === 'none' ? 'geometry' : strategy
      animatedMarks += 1
    }
  }

  for (const [key, old] of previous) {
    if (next.has(key)) continue
    exitingMarks += 1
    strategy = strategy === 'none' ? 'presence' : strategy
    if (old.parent !== null) {
      const ghost = old.clone
      ghost.removeAttribute('data-shiftcharts-mark-id')
      ghost.setAttribute('aria-hidden', 'true')
      ghost.setAttribute('data-shiftcharts-motion-ghost', '')
      ghost.setAttribute('pointer-events', 'none')
      old.parent.appendChild(ghost)
      animatePresence(ghost, duration, active, true, false)
    }
  }

  return { strategy, totalMarks: next.size, animatedMarks, enteringMarks, exitingMarks, cancelledAnimations }
}

function animatePresence(
  element: Element,
  duration: number,
  active: ActiveAnimations,
  removeAfter = false,
  entering = true,
): void {
  const html = element as HTMLElement
  const from = entering ? '0' : '1'
  const to = entering ? '1' : '0'
  html.style.opacity = from
  const animation = animateProperty(element, 'opacity', from, to, duration, active)
  if (animation === null) {
    if (removeAfter) element.remove()
    return
  }
  animation.finished.then(() => html.style.removeProperty('opacity')).catch(() => undefined)
  if (removeAfter) {
    animation.finished.then(() => element.remove()).catch(() => undefined)
  }
}

function crossfadePath(
  current: SnapshotRecord,
  old: SnapshotRecord,
  duration: number,
  active: ActiveAnimations,
): void {
  if (old.parent !== null) {
    const ghost = old.clone
    ghost.removeAttribute('data-shiftcharts-mark-id')
    ghost.setAttribute('aria-hidden', 'true')
    ghost.setAttribute('data-shiftcharts-motion-ghost', '')
    ghost.setAttribute('pointer-events', 'none')
    old.parent.insertBefore(ghost, current.element)
    animateProperty(ghost, 'opacity', '1', '0', duration, active)?.finished
      .then(() => ghost.remove())
      .catch(() => undefined)
  }
  const element = current.element as HTMLElement
  element.style.opacity = '0'
  const animation = animateProperty(current.element, 'opacity', '0', '1', duration, active)
  animation?.finished.then(() => element.style.removeProperty('opacity')).catch(() => undefined)
}

function animateProperty(
  element: Element,
  property: string,
  from: string,
  to: string,
  duration: number,
  active: ActiveAnimations,
): Animation | null {
  if (from === to || duration <= 0) return null
  const animation = element.animate(
    [{ [property]: from }, { [property]: to }],
    { duration, easing: EASING, fill: 'both' },
  )
  let animations = active.get(element)
  if (animations === undefined) {
    animations = new Set()
    active.set(element, animations)
  }
  animations.add(animation)
  animation.finished.finally(() => animations?.delete(animation)).catch(() => undefined)
  return animation
}

function cancelAnimationsForProperty(element: Element, property: string, active: ActiveAnimations): number {
  const animations = active.get(element)
  if (animations === undefined) return 0
  let cancelled = 0
  for (const animation of animations) {
    const effect = animation.effect as (AnimationEffect & { getKeyframes?: () => Keyframe[] }) | null
    const keyframes = effect?.getKeyframes?.() ?? []
    if (keyframes.some((frame) => property in frame)) {
      animation.cancel()
      animations.delete(animation)
      cancelled += 1
      if (property === 'opacity') (element as HTMLElement).style.removeProperty('opacity')
    }
  }
  return cancelled
}

function cancelElementAnimations(element: Element, active: ActiveAnimations): number {
  const animations = active.get(element)
  if (animations === undefined) return 0
  const count = animations.size
  for (const animation of animations) animation.cancel()
  animations.clear()
  ;(element as HTMLElement).style.removeProperty('opacity')
  return count
}

function cancelAll(active: ActiveAnimations): void {
  for (const animations of active.values()) {
    for (const animation of animations) animation.cancel()
  }
  active.clear()
}

function presentationValue(
  element: Element,
  property: string,
  fallback: string | undefined,
  active: ActiveAnimations,
): string | null {
  const hasAnimation = (active.get(element)?.size ?? 0) > 0
  if (hasAnimation) {
    const computed = getComputedStyle(element).getPropertyValue(property).trim()
    if (computed !== '') return computed
  }
  return fallback === undefined ? null : cssValue(property, fallback)
}

function cssValue(property: string, value: string | undefined): string | null {
  if (value === undefined || value === '') return null
  if (SVG_GEOMETRY_ATTRIBUTES.has(property) && /^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return `${value}px`
  return value
}

function durationFor(root: Element, phase: MotionPhase, quality: MotionQuality): number {
  const styles = getComputedStyle(root)
  const property = phase === 'preview'
    ? '--shiftcharts-motion-duration-cinematic-preview'
    : '--shiftcharts-motion-duration-cinematic-settle'
  const token = parseTime(styles.getPropertyValue(property))
  const base = token ?? (phase === 'preview' ? FALLBACK_PREVIEW_MS : FALLBACK_SETTLE_MS)
  if (quality === 'high') return Math.round(base * 1.15)
  if (quality === 'balanced') return Math.round(base * 0.9)
  return base
}

function parseTime(value: string): number | null {
  const match = value.trim().match(/^([\d.]+)(ms|s)$/)
  if (match === null) return null
  const amount = Number(match[1])
  return match[2] === 's' ? amount * 1000 : amount
}

function compatiblePath(from: string, to: string): boolean {
  const commands = (value: string): string[] => {
    // Chromium exposes an actively animated SVG `d` as CSS `path("M…")`, while the
    // attribute snapshot is the bare path. Compare the actual command stream, not the
    // wrapper's `p`, `a`, `t`, `h` letters, or a valid equal-command update is misclassified
    // as a crossfade on the first interrupted frame.
    const path = value.trim().replace(/^path\(\s*["']?/, '').replace(/["']?\s*\)$/, '')
    return path.match(/[a-zA-Z]/g) ?? []
  }
  const fromCommands = commands(from)
  const toCommands = commands(to)
  return fromCommands.length > 0 && fromCommands.join('') === toCommands.join('')
}
