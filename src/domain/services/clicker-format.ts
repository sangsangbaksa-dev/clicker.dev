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

/** Final consonant of the word's last sound: "none", "rieul" (ㄹ) or "other". Latin endings are guessed by letter. */
function finalSound(word: string): "none" | "rieul" | "other" {
  const ch = word.trim().slice(-1)
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28
    return jong === 0 ? "none" : jong === 8 ? "rieul" : "other"
  }
  // Latin names are read the Korean way: -t/-k/-p end in a vowel (볼트, 크, 프), -l in ㄹ,
  // -m/-n (and a silent e after them, as in Mine → 마인) in a consonant.
  const w = word.trim().toLowerCase()
  const c = w.slice(-1)
  if (c === "l") return "rieul"
  if (c === "m" || c === "n" || (c === "e" && /[mn]e$/.test(w))) return "other"
  if (/[0-9]/.test(c)) return "178".includes(c) ? "rieul" : "036".includes(c) ? "other" : "none"
  return "none"
}

/** Korean particle that fits the word: 이/가, 을/를, 은/는, (으)로. */
export function withParticle(word: string, particle: "이가" | "을를" | "은는" | "으로"): string {
  const end = finalSound(word)
  if (particle === "으로") return word + (end === "other" ? "으로" : "로")
  const [after, plain] = particle === "이가" ? ["이", "가"] : particle === "을를" ? ["을", "를"] : ["은", "는"]
  return word + (end === "none" ? plain : after)
}
