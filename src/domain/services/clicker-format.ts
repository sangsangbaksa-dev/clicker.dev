const SUFFIXES = [
  { v: 1e33, s: "Dc" },
  { v: 1e30, s: "No" },
  { v: 1e27, s: "Oc" },
  { v: 1e24, s: "Sp" },
  { v: 1e21, s: "Sx" },
  { v: 1e18, s: "Qi" },
  { v: 1e15, s: "Qa" },
  { v: 1e12, s: "T" },
  { v: 1e9, s: "B" },
  { v: 1e6, s: "M" },
  { v: 1e3, s: "K" },
]

/** CORE amounts: at most two decimals, K…Dc suffixes, scientific beyond. */
export function formatNumber(value: number): string {
  if (Number.isNaN(value)) return "0"
  if (!Number.isFinite(value)) return value < 0 ? "-∞" : "∞"
  const abs = Math.abs(value)
  // Values that round to 0.00 are plain "0", never "-0".
  if (abs < 0.005) return "0"
  const sign = value < 0 ? "-" : ""
  if (abs < 999.995) return `${sign}${trimZeros(abs.toFixed(2))}`
  if (abs >= 1e36) return `${sign}${abs.toExponential(2).replace("e+", "e")}`
  for (let i = 0; i < SUFFIXES.length; i++) {
    const { v, s } = SUFFIXES[i]
    if (abs < v) continue
    const scaled = trimZeros((abs / v).toFixed(2))
    // 999.999K rounds to "1000K": promote to the next suffix instead.
    if (scaled === "1000" && i > 0) return `${sign}1${SUFFIXES[i - 1].s}`
    return `${sign}${scaled}${s}`
  }
  return `${sign}1K` // 999.995 … 999.999 rounds up to 1K
}

function trimZeros(text: string): string {
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text
}

/**
 * CORE per second. Rates below 0.01 (a first Solar Node makes 0.003/s) keep significant digits
 * instead of rounding to "0", so the first purchase visibly does something.
 */
export function formatRate(perSecond: number): string {
  if (!Number.isFinite(perSecond) || perSecond <= 0) return formatNumber(perSecond)
  if (perSecond >= 0.01) return formatNumber(perSecond)
  if (perSecond >= 1e-4) return trimZeros(perSecond.toPrecision(2))
  return perSecond.toExponential(1)
}
