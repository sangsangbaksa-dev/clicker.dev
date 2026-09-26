const SUFFIXES = [
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

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0"
  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
  if (abs < 1000) {
    if (abs >= 100 || Number.isInteger(abs)) return `${sign}${Math.round(abs)}`
    return `${sign}${trimZeros(abs.toFixed(2))}`
  }
  for (const { v, s } of SUFFIXES) {
    if (abs >= v) return `${sign}${trimZeros((abs / v).toFixed(2))}${s}`
  }
  return `${sign}${Math.round(abs)}`
}

function trimZeros(text: string): string {
  return text.replace(/\.?0+$/, "")
}

/**
 * Seconds until `cost` is reached from passive production alone, or null when it is
 * already affordable or nothing is being produced. Mining is left out on purpose:
 * it depends on the player, so the wait shown is an upper bound.
 */
export function secondsUntilAffordable(cost: number, have: number, perSecond: number): number | null {
  if (!Number.isFinite(cost) || have >= cost) return null
  if (!(perSecond > 0)) return null
  return Math.ceil((cost - have) / perSecond)
}

/** Short Korean wait text: "45초", "3분 20초", "2시간 5분". Very long waits collapse to "99시간+". */
export function formatWait(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds))
  if (s < 60) return `${s}초`
  if (s < 3600) {
    const m = Math.floor(s / 60)
    const r = s % 60
    return r ? `${m}분 ${r}초` : `${m}분`
  }
  const h = Math.floor(s / 3600)
  if (h >= 100) return "99시간+"
  const m = Math.floor((s % 3600) / 60)
  return m ? `${h}시간 ${m}분` : `${h}시간`
}
