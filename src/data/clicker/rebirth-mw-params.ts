/**
 * Motion-wire params MW-01 / MW-02 / MW-03 — PROVISIONAL palette.
 * Times align with rebirth-motion-spec (0–3.5s full / ≤1.5s reduced).
 */

export type MwEaseSample = {
  uiFade: number
  uiScale: number
  voidAlpha: number
  stampScale: number
  chromatic: number
  shakePx: number
  rebuild: number
  allowParticleSpawn: boolean
  particleBias: "none" | "suck" | "rift" | "lanes_burst" | "outward"
}

/** Static helpers for rebirth motion-wire phases. */
export class RebirthMwParams {
  static readonly COLLAPSE_START = 0.35
  static readonly COLLAPSE_END = 0.9
  static readonly VOID_END = 1.5
  static readonly STAMP_START = 1.5
  static readonly STAMP_END = 2.2
  static readonly STAMP_IMPACT = 1.58
  static readonly STAMP_PEAK_SCALE = 1.18
  static readonly REBUILD_START = 2.2
  static readonly REBUILD_END = 3.0
  static readonly SETTLE_END = 3.5
  static readonly CENTER_DESPAWN_RADIUS = 0.08
  static readonly PHONE_PARTICLE_SOFT_MAX = 100
  static readonly DESKTOP_PARTICLE_SOFT_MAX = 180

  /** MW-01 Collapse: crumple inward, cool void only (no stamp tint). */
  static collapse(phaseT: number, reduced: boolean): MwEaseSample {
    const t = clamp01(phaseT)
    return {
      uiFade: t,
      uiScale: lerp(1, 0.55, easeInCubic(t)),
      voidAlpha: lerp(0, 0.85, easeInQuad(t)),
      stampScale: lerp(0.55, 0.08, t),
      chromatic: 0,
      shakePx: reduced ? 0 : t > 0.35 && t < 0.75 ? 1.5 : 0,
      rebuild: 0,
      allowParticleSpawn: !reduced,
      particleBias: "suck",
    }
  }

  /** Void / tear bridge before stamp. */
  static voidTear(phaseT: number, reduced: boolean): MwEaseSample {
    const t = clamp01(phaseT)
    return {
      uiFade: 1,
      uiScale: 0.55,
      voidAlpha: lerp(0.85, 0.95, t),
      stampScale: 0.05,
      chromatic: reduced ? 0 : lerp(0.35, 0.7, t),
      shakePx: 0,
      rebuild: 0,
      allowParticleSpawn: !reduced,
      particleBias: "rift",
    }
  }

  /**
   * MW-02 Stamp — structure shared across worldlines (motif/tint swap).
   * Slam 0.2 → 1.18, hold peak flat (~287ms) so every worldline hits 1.18 reliably, then ease to 1.0.
   */
  static stamp(phaseT: number, reduced: boolean): MwEaseSample {
    const t = clamp01(phaseT)
    const peak = RebirthMwParams.STAMP_PEAK_SCALE
    let stampScale: number
    if (reduced) {
      stampScale = lerp(0.85, 1, easeOutQuad(t))
    } else if (t < 0.14) {
      // Slam in (~98ms of 700ms).
      stampScale = lerp(0.2, peak, easeOutBack(t / 0.14))
    } else if (t < 0.55) {
      // Flat peak hold (~287ms) — sample-friendly across all worldlines.
      stampScale = peak
    } else if (t < 0.78) {
      stampScale = lerp(peak, 1.05, (t - 0.55) / 0.23)
    } else {
      stampScale = lerp(1.05, 1, (t - 0.78) / 0.22)
    }
    const impactWindow = t >= 0.05 && t <= 0.28
    return {
      uiFade: lerp(1, 0.45, t),
      uiScale: 0.55,
      voidAlpha: lerp(0.95, 0.65, t),
      stampScale,
      chromatic: reduced ? 0 : impactWindow ? 0.9 : lerp(0.4, 0.08, t),
      shakePx: reduced ? 0 : impactWindow ? 5.5 : 0,
      rebuild: 0,
      allowParticleSpawn: !reduced && t < 0.4,
      particleBias: "lanes_burst",
    }
  }

  /** MW-03 Rebuild: HUD from center outward. */
  static rebuild(phaseT: number, reduced: boolean): MwEaseSample {
    const t = clamp01(phaseT)
    return {
      uiFade: lerp(0.45, 0.05, easeOutQuad(t)),
      uiScale: lerp(0.85, 1, easeOutCubic(t)),
      voidAlpha: lerp(0.65, 0.18, t),
      // Keep stamp watermark readable on phone while HUD rebuilds.
      stampScale: lerp(1, 0.82, easeOutQuad(t)),
      chromatic: reduced ? 0 : lerp(0.12, 0, t),
      shakePx: reduced ? 0 : t > 0.35 && t < 0.7 ? 2.2 : 0,
      rebuild: t,
      allowParticleSpawn: !reduced && t < 0.95,
      particleBias: "outward",
    }
  }

  /** MW-03 Settle: filters die, playable idle. */
  static settle(phaseT: number): MwEaseSample {
    const t = clamp01(phaseT)
    return {
      uiFade: 0,
      uiScale: 1,
      voidAlpha: lerp(0.15, 0, t),
      stampScale: lerp(0.82, 0.28, easeOutQuad(t)),
      chromatic: 0,
      shakePx: 0,
      rebuild: 1,
      allowParticleSpawn: false,
      particleBias: "none",
    }
  }

  static selectConfirm(phaseT: number): MwEaseSample {
    const t = clamp01(phaseT)
    return {
      uiFade: t * 0.12,
      uiScale: 1,
      voidAlpha: t * 0.08,
      stampScale: lerp(0.35, 0.55, t),
      chromatic: 0,
      shakePx: 0,
      rebuild: 0,
      allowParticleSpawn: false,
      particleBias: "none",
    }
  }

  static sample(
    phase: "select_confirm" | "collapse" | "void_tear" | "stamp" | "rebuild" | "settle",
    phaseT: number,
    reduced: boolean,
  ): MwEaseSample {
    if (phase === "select_confirm") return RebirthMwParams.selectConfirm(phaseT)
    if (phase === "collapse") return RebirthMwParams.collapse(phaseT, reduced)
    if (phase === "void_tear") return RebirthMwParams.voidTear(phaseT, reduced)
    if (phase === "stamp") return RebirthMwParams.stamp(phaseT, reduced)
    if (phase === "rebuild") return RebirthMwParams.rebuild(phaseT, reduced)
    return RebirthMwParams.settle(phaseT)
  }
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp01(t)
}

function easeInQuad(t: number) {
  return t * t
}

function easeOutQuad(t: number) {
  return 1 - (1 - t) * (1 - t)
}

function easeInCubic(t: number) {
  return t * t * t
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function easeOutBack(t: number) {
  const c1 = 1.70158
  const c3 = c1 + 1
  const x = t - 1
  return 1 + c3 * x * x * x + c1 * x * x
}
