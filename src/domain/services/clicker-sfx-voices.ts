/** Limits on how many sample voices may overlap so click spam can't pile up audio work. */
export const SFX_MAX_VOICES_TOTAL = 24
export const SFX_MAX_VOICES_PER_SAMPLE = 6

export function mayStartVoice(total: number, forSample: number): boolean {
  return total < SFX_MAX_VOICES_TOTAL && forSample < SFX_MAX_VOICES_PER_SAMPLE
}
