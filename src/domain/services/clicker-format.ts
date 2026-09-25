const SUFFIXES = [
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
 * Catalog descriptions often restate the effect line ("5초 · 채굴 ×1.3 · 입문용").
 * Returns only the " · " parts the effect line doesn't already show, so cards don't print it twice.
 */
export function uniqueDescriptionParts(description: string, effectLine: string): string {
  const shown = new Set(effectLine.split("·").map((part) => part.trim()).filter(Boolean))
  return description
    .split("·")
    .map((part) => part.trim())
    .filter((part) => part && !shown.has(part))
    .join(" · ")
}
