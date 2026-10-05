/**
 * Income-curve analysis for balance work (pure; used by scripts/playtime-sim.ts and its test).
 * A curve is a list of (seconds, lifetime CORE) samples taken while one worldline is played.
 */

export type CurveSample = { t: number; life: number }

export type CurveSummary = {
  /** CORE/s per whole minute, minute 0 first. */
  perMinute: number[]
  /** Adjacent-minute ratios (rate[i] / rate[i-1]) where both minutes earned something. */
  jumps: { minute: number; ratio: number }[]
  /** Largest adjacent-minute ratio ("×" cliff). */
  maxJump: number
  /** Minutes whose rate is more than `jumpAt` times the minute before. */
  jumpMinutes: number
  /** Minutes spent after the climb in which the 10-minute trend grows by less than `plateauGrowth`. */
  plateauMinutes: number
  /** Share of the worldline spent on that plateau. */
  plateauShare: number
}

/** Mean CORE/s inside each whole minute, by linear interpolation of the lifetime counter. */
export function incomePerMinute(samples: CurveSample[]): number[] {
  if (samples.length < 2) return []
  const out: number[] = []
  const end = samples[samples.length - 1].t
  const at = (t: number) => {
    let j = 0
    while (j + 2 < samples.length && samples[j + 1].t <= t) j++
    const a = samples[j]
    const b = samples[j + 1]
    if (b.t <= a.t) return b.life
    const f = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)))
    return a.life + (b.life - a.life) * f
  }
  for (let m = 0; (m + 1) * 60 <= end + 1e-9; m++) out.push((at((m + 1) * 60) - at(m * 60)) / 60)
  return out
}

export function summarizeCurve(
  samples: CurveSample[],
  opts: { jumpAt?: number; plateauGrowth?: number; skipMinutes?: number } = {},
): CurveSummary {
  const jumpAt = opts.jumpAt ?? 2
  const plateauGrowth = opts.plateauGrowth ?? 1.25
  const perMinute = incomePerMinute(samples)
  const jumps: { minute: number; ratio: number }[] = []
  // The first minutes are clicks only (rates around zero): ratios there say nothing about the economy.
  const from = Math.max(1, opts.skipMinutes ?? 3)
  for (let i = from; i < perMinute.length; i++) {
    if (perMinute[i] > 0 && perMinute[i - 1] > 0) jumps.push({ minute: i, ratio: perMinute[i] / perMinute[i - 1] })
  }
  const maxJump = jumps.reduce((m, j) => Math.max(m, j.ratio), 0)
  const jumpMinutes = jumps.filter((j) => j.ratio > jumpAt).length
  // Plateau: once income has reached a tenth of its final level, count minutes where the mean of the
  // next 10 minutes is under `plateauGrowth` × the mean of the previous 10 (and not collapsing).
  const mean = (a: number, b: number) => {
    let s = 0
    for (let i = a; i < b; i++) s += perMinute[i]
    return s / Math.max(1, b - a)
  }
  const final = perMinute.length ? mean(Math.max(0, perMinute.length - 5), perMinute.length) : 0
  let plateauMinutes = 0
  for (let i = 10; i + 10 <= perMinute.length; i++) {
    if (perMinute[i] < final * 0.1) continue
    const before = mean(i - 10, i)
    const after = mean(i, i + 10)
    if (before > 0 && after / before < plateauGrowth) plateauMinutes++
  }
  return {
    perMinute,
    jumps,
    maxJump,
    jumpMinutes,
    plateauMinutes,
    plateauShare: perMinute.length ? plateauMinutes / perMinute.length : 0,
  }
}

/**
 * Largest minute-to-minute growth of the rolling `window`-minute mean (mean of minutes i+1..i+window over the
 * mean of i..i+window-1). Vault payouts and mine-session gaps make single minutes noisy; a real step in the
 * economy still shows here, and steady ×2/min growth reads ×2. Returns ratio 0 when the curve is too short.
 */
export function windowedMaxJump(perMinute: readonly number[], window = 3, skipMinutes = 3): { minute: number; ratio: number } {
  let best = { minute: 0, ratio: 0 }
  const mean = (a: number, b: number) => {
    let sum = 0
    for (let i = a; i < b; i++) sum += perMinute[i]
    return sum / Math.max(1, b - a)
  }
  for (let i = Math.max(1, skipMinutes); i + window < perMinute.length; i++) {
    const before = mean(i, i + window)
    const after = mean(i + 1, i + 1 + window)
    if (before > 0 && after > 0 && after / before > best.ratio) best = { minute: i + 1, ratio: after / before }
  }
  return best
}
