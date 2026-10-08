import {
  clamp01,
  clipDurationMs,
  easeInOutSine,
  easeOutCubic,
  lerp,
  sampleClip,
  smoothstep,
  type Clip,
} from "./clicker-sprite-clock.ts"

/*
 * Motion of the Core Guardian (pure). Time in, "which pictures at which weight, and which squash /
 * lean / glow on top" out. The art only has a few frames per clip, so everything between them is
 * eased here: crossfades between keyframes, a spring-like hit recoil, an enrage pulse, the lunge
 * when it strikes the player, defeat collapse and re-appear. All body transforms are meant to be
 * applied around the feet pivot (scale + skew only, never a vertical shift), so the feet stay on
 * the ground line in every frame.
 */

export type ClipName = "idle" | "hit" | "defeat" | "appear"

export const GUARDIAN_CLIPS: Readonly<Record<ClipName, Clip>> = {
  idle: { frames: 6, fps: 6, loop: true },
  hit: { frames: 3, fps: 12, loop: false },
  defeat: { frames: 6, fps: 8, loop: false },
  appear: { frames: 6, fps: 8, loop: false },
}

/**
 * The collapsed guardian stays gone this long before it would rise again. The fight screen steps
 * out about 2.2 s after the kill, so in the game it never rises; it appears afresh on re-entry.
 */
export const DEFEAT_HOLD_MS = 3000
/** The ground shadow fades away over this long once the collapse is well under way. */
export const DEFEAT_SHADOW_FADE_MS = 1200
/** Hit picture fades in over this long (the first hit frame is a flash). */
export const HIT_IN_MS = 24
/** ...and eases back into the idle loop over this long after the clip ends. */
export const HIT_SETTLE_MS = 110
/** The hit clip (a bright flash) restarts at most this often: no strobing under rapid taps. */
export const HIT_CLIP_COOLDOWN_MS = 250
/** Reduced motion: a single calm swap to the flash frame for this long. */
export const HIT_REDUCED_MS = 160
/** Reduced motion: appear / defeat are plain fades this long. */
export const REDUCED_FADE_MS = 300
export const ATTACK_MS = 520
const HIT_POSE_MS = 450
const HIT_TAU_MS = 55

export type Phase = "appear" | "idle" | "defeat"

export type MotionState = {
  readonly phase: Phase
  /** When `phase` began (ms, same clock as `now`). */
  readonly since: number
  /** Recent hits, newest last (pruned). `side` alternates so the lean flips left / right. */
  readonly hits: readonly { readonly at: number; readonly side: 1 | -1 }[]
  /** Start of the hit clip currently showing / just shown. */
  readonly hitClipAt: number | null
  readonly attackAt: number | null
}

export const startMotion = (now: number, phase: Phase = "appear"): MotionState => ({
  phase,
  since: now,
  hits: [],
  hitClipAt: null,
  attackAt: null,
})

const appearMs = clipDurationMs(GUARDIAN_CLIPS.appear)
const defeatMs = clipDurationMs(GUARDIAN_CLIPS.defeat)
const hitMs = clipDurationMs(GUARDIAN_CLIPS.hit)

/** Moves finished phases on: appear -> idle, defeat (+ hold) -> appear. */
export function settleMotion(s: MotionState, now: number): MotionState {
  let cur = s
  for (let guard = 0; guard < 3; guard++) {
    if (cur.phase === "appear" && now - cur.since >= appearMs) cur = { ...cur, phase: "idle", since: cur.since + appearMs }
    else if (cur.phase === "defeat" && now - cur.since >= defeatMs + DEFEAT_HOLD_MS)
      cur = { ...cur, phase: "appear", since: cur.since + defeatMs + DEFEAT_HOLD_MS, hits: [], hitClipAt: null, attackAt: null }
    else break
  }
  return cur
}

/** A strike landed on the guardian. Ignored while it is collapsing. */
export function registerHit(s: MotionState, now: number): MotionState {
  const cur = settleMotion(s, now)
  if (cur.phase === "defeat") return cur
  const last = cur.hits[cur.hits.length - 1]
  const side: 1 | -1 = last ? (last.side === 1 ? -1 : 1) : 1
  const hits = [...cur.hits.filter((h) => now - h.at < HIT_POSE_MS), { at: now, side }]
  const clipFree = cur.hitClipAt === null || now - cur.hitClipAt >= HIT_CLIP_COOLDOWN_MS
  return { ...cur, hits, hitClipAt: clipFree ? now : cur.hitClipAt }
}

/** The guardian strikes at the player. */
export function registerAttack(s: MotionState, now: number): MotionState {
  const cur = settleMotion(s, now)
  return cur.phase === "defeat" ? cur : { ...cur, attackAt: now }
}

export function registerDefeat(s: MotionState, now: number): MotionState {
  const cur = settleMotion(s, now)
  return cur.phase === "defeat" ? cur : { ...cur, phase: "defeat", since: now, hits: [], hitClipAt: null, attackAt: null }
}

export function registerAppear(s: MotionState, now: number): MotionState {
  return { ...s, phase: "appear", since: now, hits: [], hitClipAt: null, attackAt: null }
}

export type Layer = { readonly clip: ClipName; readonly index: number; readonly weight: number }
export type Pose = {
  readonly scaleX: number
  readonly scaleY: number
  /** Degrees, about the feet pivot. */
  readonly skewDeg: number
  /** 0..1 extra glow (enrage). */
  readonly glow: number
}
export type MotionSample = {
  readonly phase: Phase
  /** Pictures to composite (weights sum to ~1). */
  readonly layers: readonly Layer[]
  readonly pose: Pose
  /** Whole-sprite opacity. */
  readonly opacity: number
  readonly shadow: { readonly opacity: number; readonly widen: number }
}

export type SampleOptions = {
  readonly reduced?: boolean
  /** 0..1, how enraged the guardian is. */
  readonly enrage?: number
}

export const NEUTRAL_POSE: Pose = { scaleX: 1, scaleY: 1, skewDeg: 0, glow: 0 }

/** Kick shaped like t * e^(-t/tau): rises fast, peaks at tau, dies away (1 at its peak). */
export function kick(tMs: number, tauMs = HIT_TAU_MS): number {
  if (!(tMs > 0)) return 0
  const x = tMs / tauMs
  return x * Math.exp(1 - x)
}

/** Lunge scale for the guardian's own strike: wind-up dip, fast surge, slow return. */
export function lungeScale(tMs: number): number {
  const p = tMs / ATTACK_MS
  if (!(p > 0) || p >= 1) return 1
  if (p < 0.25) return lerp(1, 0.97, easeInOutSine(p / 0.25))
  if (p < 0.55) return lerp(0.97, 1.05, easeOutCubic((p - 0.25) / 0.3))
  return lerp(1.05, 1, easeInOutSine((p - 0.55) / 0.45))
}

function pushLayer(out: Layer[], clip: ClipName, index: number, weight: number): void {
  if (weight < 0.002) return
  const at = out.findIndex((l) => l.clip === clip && l.index === index)
  if (at >= 0) out[at] = { clip, index, weight: out[at]!.weight + weight }
  else out.push({ clip, index, weight })
}

function pushClip(out: Layer[], clip: ClipName, tMs: number, weight: number, stepped: boolean): void {
  const m = sampleClip(GUARDIAN_CLIPS[clip], tMs, stepped ? () => 0 : smoothstep)
  pushLayer(out, clip, m.a, weight * (1 - m.mix))
  if (m.b !== m.a) pushLayer(out, clip, m.b, weight * m.mix)
}

function normalize(layers: Layer[]): Layer[] {
  const sum = layers.reduce((n, l) => n + l.weight, 0)
  return sum > 0 && Math.abs(sum - 1) > 1e-9 ? layers.map((l) => ({ ...l, weight: l.weight / sum })) : layers
}

export function sampleMotion(state: MotionState, now: number, opts: SampleOptions = {}): MotionSample {
  const s = settleMotion(state, now)
  const t = Math.max(0, now - s.since)
  const reduced = opts.reduced === true
  const enrage = clamp01(opts.enrage ?? 0)
  const layers: Layer[] = []
  let opacity = 1
  let shadowOpacity = 1
  let pose = NEUTRAL_POSE

  if (s.phase === "appear") {
    const p = clamp01(t / appearMs)
    if (reduced) {
      pushLayer(layers, "idle", 0, 1)
      opacity = smoothstep(t / REDUCED_FADE_MS)
    } else pushClip(layers, "appear", t, 1, false)
    shadowOpacity = easeOutCubic(reduced ? t / REDUCED_FADE_MS : p)
  } else if (s.phase === "defeat") {
    const p = clamp01(t / defeatMs)
    if (reduced) {
      pushLayer(layers, "idle", 0, 1)
      opacity = 1 - smoothstep(t / REDUCED_FADE_MS)
    } else {
      pushClip(layers, "defeat", t, 1, false)
      pose = {
        scaleX: 1 + 0.04 * easeOutCubic(p),
        scaleY: 1 - 0.06 * easeOutCubic(p),
        skewDeg: 0,
        glow: 0,
      }
    }
    shadowOpacity = 1 - smoothstep((t - 0.3 * defeatMs) / DEFEAT_SHADOW_FADE_MS)
  } else {
    const idleT = t
    const hitT = s.hitClipAt === null ? Number.POSITIVE_INFINITY : now - s.hitClipAt
    if (reduced) {
      if (hitT >= 0 && hitT < HIT_REDUCED_MS) pushLayer(layers, "hit", 1, 1)
      else pushLayer(layers, "idle", 0, 1)
    } else if (hitT >= 0 && hitT < hitMs + HIT_SETTLE_MS) {
      // Hit picture over the idle loop: fades in fast, plays, then eases back into the loop.
      const wHit = hitT < hitMs ? smoothstep(hitT / HIT_IN_MS) : 1 - smoothstep((hitT - hitMs) / HIT_SETTLE_MS)
      pushClip(layers, "hit", hitT, wHit, false)
      pushClip(layers, "idle", idleT, 1 - wHit, false)
    } else pushClip(layers, "idle", idleT, 1, false)

    if (!reduced) {
      let k = 0
      let lean = 0
      for (const h of s.hits) {
        if (now - h.at >= HIT_POSE_MS) continue
        const hk = kick(now - h.at)
        k += hk
        lean += h.side * hk
      }
      k = Math.min(k, 1.35)
      lean = Math.max(-1.35, Math.min(1.35, lean))
      const lunge = s.attackAt === null ? 1 : lungeScale(now - s.attackAt)
      const wave = Math.sin((now / (1100 - 500 * enrage)) * Math.PI * 2)
      const pulse = 1 + 0.008 * enrage * wave
      pose = {
        scaleX: (1 + 0.042 * k) * lunge * pulse,
        scaleY: (1 - 0.058 * k) * lunge * pulse,
        skewDeg: 1.6 * lean,
        glow: enrage * (0.35 + 0.35 * wave),
      }
    }
  }

  const widen = reduced ? 1 : 1 + (pose.scaleX - 1) * 1.5
  return {
    phase: s.phase,
    layers: normalize(layers),
    pose,
    opacity,
    shadow: { opacity: shadowOpacity, widen },
  }
}

/** How enraged the guardian looks for a given HP share: calm above `from`, full at `to`. */
export function enrageLevel(hpRatio: number, from = 0.4, to = 0.1): number {
  if (!Number.isFinite(hpRatio)) return 0
  return smoothstep((from - hpRatio) / (from - to))
}

/** File stem of a frame, e.g. `idle_03`. */
export const frameId = (clip: ClipName, index: number): string => `${clip}_${String(index).padStart(2, "0")}`

/** Every frame of every clip, in the order worth preloading (what shows first comes first). */
export function allFrames(order: readonly ClipName[] = ["appear", "idle", "hit", "defeat"]): { clip: ClipName; index: number }[] {
  return order.flatMap((clip) => Array.from({ length: GUARDIAN_CLIPS[clip].frames }, (_, index) => ({ clip, index })))
}

/**
 * Keeps only the layers whose picture is already loaded and renormalises the weights, so a frame
 * that has not arrived yet never makes the guardian blink out. Empty when nothing is available.
 */
export function restrictLayers(layers: readonly Layer[], has: (l: Layer) => boolean): Layer[] {
  const ok = layers.filter(has)
  const sum = ok.reduce((n, l) => n + l.weight, 0)
  return sum > 0 ? ok.map((l) => ({ ...l, weight: l.weight / sum })) : []
}

/** The frame each layer is about to need (next keyframe), so it can be mounted a beat early. */
export function lookahead(layers: readonly Layer[]): { clip: ClipName; index: number }[] {
  const out: { clip: ClipName; index: number }[] = []
  for (const l of layers) {
    const c = GUARDIAN_CLIPS[l.clip]
    const next = l.index + 1 < c.frames ? l.index + 1 : c.loop ? 0 : l.index
    if (next !== l.index) out.push({ clip: l.clip, index: next })
  }
  return out
}

/**
 * How a fight that just vanished from the run ended. The engine clears `boss` for a win, a timeout
 * and a knock-out alike, so read it off the last snapshot: out of time -> lost; the player could
 * not survive another blow -> lost; otherwise the guardian fell.
 */
export function bossFightOutcome(
  last: { readonly playerHp: number; readonly endsAt: number },
  now: number,
  attackDamage: number,
): "won" | "lost" {
  if (now >= last.endsAt) return "lost"
  if (last.playerHp <= attackDamage) return "lost"
  return "won"
}
