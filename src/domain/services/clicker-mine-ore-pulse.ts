/** Resonance before the center ore visually shatters; mining continues after a short regrow. */
export const ORE_PULSE_MAX = 24

export const ORE_REGROW_MS = 650

export function orePulseDamage(critical: boolean): number {
  return critical ? 2 : 1
}

export function nextOrePulse(
  current: number,
  critical: boolean,
): { remaining: number; shattered: boolean } {
  const next = current - orePulseDamage(critical)
  if (next > 0) return { remaining: next, shattered: false }
  return { remaining: 0, shattered: true }
}
