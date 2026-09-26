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

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0"
  const sign = value < 0 ? "-" : ""
  const abs = Math.abs(value)
  // Past the last suffix, scientific notation keeps it short instead of "8760000Dc".
  if (abs >= 1e36) return `${sign}${abs.toExponential(2).replace("e+", "e")}`
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
