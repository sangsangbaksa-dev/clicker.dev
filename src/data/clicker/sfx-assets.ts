/**
 * SFX asset paths — v2 mp3 pack (legacy ogg/wav names kept on disk; constants point here).
 * See `public/clicker/audio/README-sfx-v2.txt`.
 */

export const CLICKER_SFX_AUDIO_BASE = "/clicker/audio"

/** v2 filenames (mp3). */
export const SFX_V2 = {
  uiTap: `${CLICKER_SFX_AUDIO_BASE}/sfx_ui_tap_v2.mp3`,
  worldlineHover: `${CLICKER_SFX_AUDIO_BASE}/sfx_worldline_hover_v2.mp3`,
  uiPurchase: `${CLICKER_SFX_AUDIO_BASE}/sfx_ui_purchase_v2.mp3`,
  upgradeLevel: `${CLICKER_SFX_AUDIO_BASE}/sfx_upgrade_level_v2.mp3`,
  producerBuy: `${CLICKER_SFX_AUDIO_BASE}/sfx_producer_buy_v2.mp3`,
  coreHitLight: `${CLICKER_SFX_AUDIO_BASE}/sfx_core_hit_light_v2.mp3`,
  coreHitHeavy: `${CLICKER_SFX_AUDIO_BASE}/sfx_core_hit_heavy_v2.mp3`,
  coreCrit: `${CLICKER_SFX_AUDIO_BASE}/sfx_core_crit_v2.mp3`,
  rebirthStampAureliaGrid: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_stamp_aurelia_grid_v2.mp3`,
  rebirthStampVolatileCore: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_stamp_volatile_core_v2.mp3`,
  rebirthStampDirectivePulse: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_stamp_directive_pulse_v2.mp3`,
  rebirthStampResonanceProtocol: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_stamp_resonance_protocol_v2.mp3`,
} as const

/** Legacy handoff basename → active v2 URL (v1 files may remain under public/clicker/audio). */
export const SFX_LEGACY_TO_V2_URL: Record<string, string> = {
  sfx_ui_tap: SFX_V2.uiTap,
  sfx_worldline_hover: SFX_V2.worldlineHover,
  sfx_ui_purchase: SFX_V2.uiPurchase,
  sfx_upgrade_level: SFX_V2.upgradeLevel,
  sfx_producer_buy: SFX_V2.producerBuy,
  sfx_core_hit_light: SFX_V2.coreHitLight,
  sfx_core_hit_heavy: SFX_V2.coreHitHeavy,
  sfx_core_crit: SFX_V2.coreCrit,
  sfx_rebirth_stamp_aurelia_grid: SFX_V2.rebirthStampAureliaGrid,
  sfx_rebirth_stamp_volatile_core: SFX_V2.rebirthStampVolatileCore,
  sfx_rebirth_stamp_directive_pulse: SFX_V2.rebirthStampDirectivePulse,
  sfx_rebirth_stamp_resonance_protocol: SFX_V2.rebirthStampResonanceProtocol,
}

const STAMP_V2: Record<string, string> = {
  aurelia_grid: SFX_V2.rebirthStampAureliaGrid,
  volatile_core: SFX_V2.rebirthStampVolatileCore,
  directive_pulse: SFX_V2.rebirthStampDirectivePulse,
  resonance_protocol: SFX_V2.rebirthStampResonanceProtocol,
  adaptive_architect: SFX_V2.rebirthStampDirectivePulse,
}

export function rebirthStampSampleUrl(worldlineKey: string): string | undefined {
  return STAMP_V2[worldlineKey]
}

export const SFX_V2_PRELOAD_URLS: readonly string[] = Object.values(SFX_V2)
