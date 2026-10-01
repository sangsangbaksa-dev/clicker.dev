/** Strikes per second allowed in the mine (taps, Space and the assist drill share one limiter). */
export const MINE_MAX_CPS = 11

/**
 * Rolling one-second limiter. `window` holds the timestamps (ms) of strikes that landed;
 * the caller keeps it. Returns true (and records `now`) when this strike may land,
 * false when it is over the cap and must be dropped.
 */
export function allowStrike(window: number[], now: number, maxPerSecond: number = MINE_MAX_CPS): boolean {
  while (window.length && now - window[0] >= 1000) window.shift()
  if (window.length >= maxPerSecond) return false
  window.push(now)
  return true
}
