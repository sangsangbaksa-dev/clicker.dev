"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import type { GuardianLayout } from "@/application/clicker-guardian-frame"
import { GUARDIAN_SHADOW_SRC, GUARDIAN_SPRITE, awakenedGuardianTier, guardianFrameSrc, type GuardianTier } from "@/data/clicker/guardian-sprite"
import {
  allFrames,
  frameId,
  lookahead,
  registerAttack,
  registerDefeat,
  registerHit,
  restrictLayers,
  sampleMotion,
  startMotion,
  type ClipName,
  type MotionState,
} from "@/application/clicker-guardian-motion"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"

type Props = {
  layout: GuardianLayout
  /** Counters: each increment is one event (strike landed / guardian struck / guardian fell). */
  hits: number
  attacks: number
  defeats: number
  /** 0..1 */
  enrage: number
  /** 각성 수호자 art. */
  awakened?: boolean
}

const fileKey = (tier: GuardianTier, clip: ClipName, index: number) => `${tier.dir}/${frameId(clip, index)}`

/** Loads (and decodes) every frame of a tier; resolves once the first-needed frames (appear + idle) are ready. */
function preloadTier(tier: GuardianTier, loaded: Set<string>, keep: HTMLImageElement[], isStale: () => boolean): Promise<void> {
  const load = async ({ clip, index }: { clip: ClipName; index: number }) => {
    const im = new Image()
    im.decoding = "async"
    im.src = guardianFrameSrc(tier, clip, index)
    keep.push(im)
    try {
      await im.decode()
      loaded.add(fileKey(tier, clip, index))
    } catch {
      /* a missing frame is skipped by restrictLayers */
    }
  }
  const all = allFrames()
  const first = all.filter((f) => f.clip === "appear" || f.clip === "idle")
  const rest = all.filter((f) => f.clip !== "appear" && f.clip !== "idle")
  return Promise.all(first.map(load)).then(() => {
    if (!isStale()) void Promise.all(rest.map(load))
  })
}

/**
 * The Core Guardian as a feet-anchored sprite: frames crossfaded by the pure motion clock, a
 * squash / lean pose applied around the feet pivot, and a contact shadow on the ground line.
 * Only reads the clock and writes styles; what moves how is decided in clicker-guardian-motion.
 */
export function GuardianSprite({ layout, hits, attacks, defeats, enrage, awakened = false }: Props) {
  const reduced = usePrefersReducedMotion()
  const { art, shadow } = layout
  const wantedTier = awakened ? awakenedGuardianTier(layout.tier) : layout.tier
  const [readyTier, setReadyTier] = useState<GuardianTier | null>(null)
  const [need, setNeed] = useState<readonly { clip: ClipName; index: number; w: number }[]>([])
  const loadedRef = useRef(new Set<string>())
  const keepRef = useRef<HTMLImageElement[]>([])
  const stateRef = useRef<MotionState | null>(null)
  const needKeyRef = useRef("")
  const bodyRef = useRef<HTMLDivElement>(null)
  const shadowRefs = useRef<(HTMLImageElement | null)[]>([])
  const imgsRef = useRef(new Map<string, HTMLImageElement>())
  const liveRef = useRef({ reduced, enrage, tier: readyTier })
  useEffect(() => {
    liveRef.current = { reduced, enrage, tier: readyTier }
  }, [reduced, enrage, readyTier])
  const counts = useRef({ hits, attacks, defeats })

  // Fetch the resolution that suits the displayed size; keep showing the old one until the new one is in.
  useEffect(() => {
    let stale = false
    void preloadTier(wantedTier, loadedRef.current, keepRef.current, () => stale).then(() => {
      if (!stale) setReadyTier(wantedTier)
    })
    return () => {
      stale = true
    }
  }, [wantedTier])

  // Gameplay events -> motion state.
  useEffect(() => {
    const prev = counts.current
    counts.current = { hits, attacks, defeats }
    const st = stateRef.current
    if (!st) return
    const now = performance.now()
    let next = st
    if (defeats > prev.defeats) next = registerDefeat(next, now)
    else if (hits > prev.hits) next = registerHit(next, now)
    if (attacks > prev.attacks) next = registerAttack(next, now)
    stateRef.current = next
  }, [hits, attacks, defeats])

  // Frame loop: sample the clock, set weights / pose directly on the elements.
  useEffect(() => {
    if (!readyTier) return
    let raf = 0
    const tick = () => {
      const now = performance.now()
      const live = liveRef.current
      if (!live.tier) return
      const st = (stateRef.current ??= startMotion(now))
      const sample = sampleMotion(st, now, { reduced: live.reduced, enrage: live.enrage })
      const layers = restrictLayers(sample.layers, (l) => loadedRef.current.has(fileKey(live.tier!, l.clip, l.index)))
      const weights = new Map<string, number>()
      for (const l of layers) weights.set(frameId(l.clip, l.index), l.weight)
      const wanted = [...layers, ...lookahead(layers)].filter((l, i, a) => a.findIndex((m) => m.clip === l.clip && m.index === l.index) === i)
      const key = wanted.map((l) => frameId(l.clip, l.index)).sort().join(",")
      if (key !== needKeyRef.current) {
        needKeyRef.current = key
        setNeed(wanted.map((l) => ({ clip: l.clip, index: l.index, w: weights.get(frameId(l.clip, l.index)) ?? 0 })))
      }
      for (const [id, el] of imgsRef.current) el.style.opacity = String(weights.get(id) ?? 0)
      const body = bodyRef.current
      if (body) {
        const p = sample.pose
        body.style.transform = p.scaleX === 1 && p.scaleY === 1 && p.skewDeg === 0 ? "none" : `scale(${p.scaleX}, ${p.scaleY}) skewX(${p.skewDeg}deg)`
        body.style.opacity = String(sample.opacity)
        body.style.filter = p.glow > 0.01 ? `brightness(${1 + 0.18 * p.glow}) saturate(${1 + 0.35 * p.glow})` : "none"
        body.dataset.phase = sample.phase
      }
      // Two stacked copies: a soft wide shadow, and a darker contact core where the base meets the floor.
      shadowRefs.current.forEach((sh, i) => {
        if (!sh) return
        sh.style.opacity = String(sample.shadow.opacity * (i === 0 ? 1 : 0.55))
        sh.style.transform = sample.shadow.widen === 1 ? "none" : `scaleX(${sample.shadow.widen})`
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [readyTier])

  if (!readyTier) return null
  const bodyStyle: CSSProperties = {
    left: art.left,
    top: art.top,
    width: art.width,
    height: art.height,
    transformOrigin: `${GUARDIAN_SPRITE.pivot.x * art.scale}px ${GUARDIAN_SPRITE.pivot.y * art.scale}px`,
  }
  return (
    <div className="guardian-ground" aria-hidden>
      {[0, 1].map((i) => (
        <img
          key={i}
          ref={(el) => {
            shadowRefs.current[i] = el
          }}
          className="guardian-shadow"
          src={GUARDIAN_SHADOW_SRC}
          alt=""
          draggable={false}
          style={{ left: shadow.x, top: shadow.y, width: shadow.w, height: shadow.h, opacity: 0 }}
        />
      ))}
      <div ref={bodyRef} className="guardian-body" style={bodyStyle}>
        {need.map(({ clip, index, w }) => {
          const id = frameId(clip, index)
          return (
            <img
              key={`${readyTier.id}/${id}`}
              ref={(el) => {
                if (el) imgsRef.current.set(id, el)
                else imgsRef.current.delete(id)
              }}
              className="guardian-frame"
              src={guardianFrameSrc(readyTier, clip, index)}
              alt=""
              draggable={false}
              style={{ opacity: w }}
            />
          )
        })}
      </div>
    </div>
  )
}
