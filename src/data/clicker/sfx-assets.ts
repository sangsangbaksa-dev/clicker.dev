/**
 * SFX asset paths — v2/v3 mp3 packs (legacy ogg/wav names kept on disk; constants point here).
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

/** v3 epic / skill SFX (mp3). */
export const SFX_V3 = {
  skillSeismicWave: `${CLICKER_SFX_AUDIO_BASE}/sfx_skill_seismic_wave_v3.mp3`,
  skillOverdrive: `${CLICKER_SFX_AUDIO_BASE}/sfx_skill_overdrive_v3.mp3`,
  skillPulseBurst: `${CLICKER_SFX_AUDIO_BASE}/sfx_skill_pulse_burst_v3.mp3`,
  skillFeverStart: `${CLICKER_SFX_AUDIO_BASE}/sfx_skill_fever_start_v3.mp3`,
  skillUnlock: `${CLICKER_SFX_AUDIO_BASE}/sfx_skill_unlock_v3.mp3`,
  potionFever: `${CLICKER_SFX_AUDIO_BASE}/sfx_potion_fever_v3.mp3`,
  yieldBig: `${CLICKER_SFX_AUDIO_BASE}/sfx_yield_big_v3.mp3`,
  oreHoldRelease: `${CLICKER_SFX_AUDIO_BASE}/sfx_ore_hold_release_v3.mp3`,
  enterMine: `${CLICKER_SFX_AUDIO_BASE}/sfx_enter_mine_v3.mp3`,
  exitMine: `${CLICKER_SFX_AUDIO_BASE}/sfx_exit_mine_v3.mp3`,
  rebirthOpen: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_open_v3.mp3`,
  rebirthRebuildRise: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_rebuild_rise_v3.mp3`,
  rebirthSettleChime: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_settle_chime_v3.mp3`,
  rebirthVoidTear: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_void_tear_v3.mp3`,
  transcendOpen: `${CLICKER_SFX_AUDIO_BASE}/sfx_transcend_open_v3.mp3`,
  sessionTimerEnd: `${CLICKER_SFX_AUDIO_BASE}/sfx_session_timer_end_v3.mp3`,
} as const

/** Rebirth ceremony HQ SFX + stamp variants (mp3). */
export const SFX_REBIRTH_HQ = {
  trigger: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_trigger_hq.mp3`,
  rebuild: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_rebuild_hq.mp3`,
  complete: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_complete_hq.mp3`,
  stampAureliaGrid: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_stamp_aurelia_grid_hq.mp3`,
  stampVolatileCore: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_stamp_volatile_core_hq.mp3`,
  stampDirectivePulse: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_stamp_directive_pulse_hq.mp3`,
  stampResonanceProtocol: `${CLICKER_SFX_AUDIO_BASE}/sfx_rebirth_stamp_resonance_protocol_hq.mp3`,
} as const

/** Final boss (core guardian) SFX v1 (mp3). */
export const SFX_BOSS_V1 = {
  appear: `${CLICKER_SFX_AUDIO_BASE}/sfx_boss_appear_v1.mp3`,
  hit: `${CLICKER_SFX_AUDIO_BASE}/sfx_boss_hit_v1.mp3`,
  phaseChange: `${CLICKER_SFX_AUDIO_BASE}/sfx_boss_phase_change_v1.mp3`,
  defeat: `${CLICKER_SFX_AUDIO_BASE}/sfx_boss_defeat_v1.mp3`,
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

/** Legacy basename → active v3 URL. */
export const SFX_LEGACY_TO_V3_URL: Record<string, string> = {
  sfx_skill_seismic_wave: SFX_V3.skillSeismicWave,
  sfx_skill_overdrive: SFX_V3.skillOverdrive,
  sfx_skill_pulse_burst: SFX_V3.skillPulseBurst,
  sfx_skill_fever_start: SFX_V3.skillFeverStart,
  sfx_skill_unlock: SFX_V3.skillUnlock,
  sfx_potion_fever: SFX_V3.potionFever,
  sfx_yield_big: SFX_V3.yieldBig,
  sfx_ore_hold_release: SFX_V3.oreHoldRelease,
  sfx_enter_mine: SFX_V3.enterMine,
  sfx_exit_mine: SFX_V3.exitMine,
  sfx_rebirth_open: SFX_V3.rebirthOpen,
  sfx_rebirth_rebuild_rise: SFX_V3.rebirthRebuildRise,
  sfx_rebirth_settle_chime: SFX_V3.rebirthSettleChime,
  sfx_rebirth_void_tear: SFX_V3.rebirthVoidTear,
  sfx_transcend_open: SFX_V3.transcendOpen,
  sfx_session_timer_end: SFX_V3.sessionTimerEnd,
  sfx_boss_appear: SFX_BOSS_V1.appear,
  sfx_boss_hit: SFX_BOSS_V1.hit,
  sfx_boss_phase_change: SFX_BOSS_V1.phaseChange,
  sfx_boss_defeat: SFX_BOSS_V1.defeat,
}

/** Rebirth motion placeholder cue name → HQ sample URL (see `REBIRTH_MOTION_SAMPLE_FALLBACK`). */
export const REBIRTH_MOTION_SAMPLE: Record<string, string> = {
  sfx_rebirth_confirm_click: SFX_REBIRTH_HQ.trigger,
  sfx_rebirth_rebuild_rise: SFX_REBIRTH_HQ.rebuild,
  sfx_rebirth_settle_chime: SFX_REBIRTH_HQ.complete,
  sfx_rebirth_void_tear: SFX_V3.rebirthVoidTear,
}

/** v3/v2 fallback when HQ mp3 is unavailable. */
export const REBIRTH_MOTION_SAMPLE_FALLBACK: Record<string, string> = {
  sfx_rebirth_confirm_click: SFX_V3.rebirthOpen,
  sfx_rebirth_rebuild_rise: SFX_V3.rebirthRebuildRise,
  sfx_rebirth_settle_chime: SFX_V3.rebirthSettleChime,
  sfx_rebirth_void_tear: SFX_V3.rebirthVoidTear,
}

const STAMP_HQ: Record<string, string> = {
  aurelia_grid: SFX_REBIRTH_HQ.stampAureliaGrid,
  volatile_core: SFX_REBIRTH_HQ.stampVolatileCore,
  directive_pulse: SFX_REBIRTH_HQ.stampDirectivePulse,
  resonance_protocol: SFX_REBIRTH_HQ.stampResonanceProtocol,
  adaptive_architect: SFX_REBIRTH_HQ.stampDirectivePulse,
}

const STAMP_V2: Record<string, string> = {
  aurelia_grid: SFX_V2.rebirthStampAureliaGrid,
  volatile_core: SFX_V2.rebirthStampVolatileCore,
  directive_pulse: SFX_V2.rebirthStampDirectivePulse,
  resonance_protocol: SFX_V2.rebirthStampResonanceProtocol,
  adaptive_architect: SFX_V2.rebirthStampDirectivePulse,
}

/** Shop active-skill id → v3 cast sample (fallback: pulse burst). */
const ACTIVE_SKILL_V3: Record<string, string> = {
  overclock: SFX_V3.skillOverdrive,
  core_pulse: SFX_V3.skillPulseBurst,
  stabilizer: SFX_V3.skillSeismicWave,
  laser_focus: SFX_V3.skillPulseBurst,
  time_warp: SFX_V3.skillPulseBurst,
  grid_boost: SFX_V3.skillOverdrive,
}

export function rebirthStampSampleUrl(worldlineKey: string): string | undefined {
  return STAMP_HQ[worldlineKey] ?? STAMP_V2[worldlineKey]
}

export function rebirthStampSampleFallbackUrl(worldlineKey: string): string | undefined {
  return STAMP_V2[worldlineKey]
}

export function activeSkillSampleUrl(skillId: string): string {
  return ACTIVE_SKILL_V3[skillId] ?? SFX_V3.skillPulseBurst
}

export const SFX_V2_PRELOAD_URLS: readonly string[] = Object.values(SFX_V2)
export const SFX_V3_PRELOAD_URLS: readonly string[] = Object.values(SFX_V3)
export const SFX_BOSS_V1_PRELOAD_URLS: readonly string[] = Object.values(SFX_BOSS_V1)
export const SFX_REBIRTH_HQ_PRELOAD_URLS: readonly string[] = Object.values(SFX_REBIRTH_HQ)
export const SFX_PRELOAD_URLS: readonly string[] = [
  ...SFX_V2_PRELOAD_URLS,
  ...SFX_V3_PRELOAD_URLS,
  ...SFX_BOSS_V1_PRELOAD_URLS,
  ...SFX_REBIRTH_HQ_PRELOAD_URLS,
]
