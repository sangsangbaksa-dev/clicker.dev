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
  if (!Number.isFinite(value)) return "0"
  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
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
