import type { GameSfxEvent, GameSfxLoop } from "@/application/clicker-sfx-events"

/** Waldusic's 9/29-tone effects (event → file under /clicker/audio). mp3 only; the wavs stay out of the bundle. */
const BASE = "/clicker/audio"
export const LEGACY_SFX_FILE: Record<GameSfxEvent, string> = {
  uiTap: "sfx_ui_tap_legacy.mp3",
  uiPurchase: "sfx_ui_purchase_legacy.mp3",
  upgrade: "sfx_upgrade_legacy.mp3",
  producerBuy: "sfx_producer_buy_legacy.mp3",
  skillUnlock: "sfx_skill_unlock_legacy.mp3",
  skillSeismicWave: "sfx_skill_seismic_wave_legacy.mp3",
  skillOverdrive: "sfx_skill_overdrive_legacy.mp3",
  skillPulseBurst: "sfx_skill_pulse_burst_legacy.mp3",
  skillFeverStart: "sfx_skill_fever_start_legacy.mp3",
  skillTimeStop: "sfx_skill_time_stop_legacy.mp3",
  skillCoreOverload: "sfx_skill_core_overload_legacy.mp3",
  coreHit: "sfx_core_hit_legacy.mp3",
  coreHitHeavy: "sfx_core_hit_heavy_legacy.mp3",
  enterMine: "sfx_enter_mine_legacy.mp3",
  exitMine: "sfx_exit_mine_legacy.mp3",
  rebirthOpen: "sfx_rebirth_open_legacy.mp3",
  rebirthStamp: "sfx_rebirth_stamp_legacy.mp3",
  rebirthComplete: "sfx_rebirth_complete_legacy.mp3",
  monsterAppear: "sfx_monster_appear_legacy.mp3",
  monsterHit: "sfx_monster_hit_legacy.mp3",
  monsterDefeat: "sfx_monster_defeat_legacy.mp3",
  bossAppear: "sfx_boss_appear_legacy.mp3",
  bossHit: "sfx_boss_hit_legacy.mp3",
  bossPhaseChange: "sfx_boss_phase_change_legacy.mp3",
  bossDefeat: "sfx_boss_defeat_legacy.mp3",
  sessionTimerEnd: "sfx_session_timer_end_legacy.mp3",
  rebirthCollapse: "sfx_rebirth_collapse_legacy.mp3",
  rebirthVoidTear: "sfx_rebirth_void_tear_legacy.mp3",
  rebirthRebuild: "sfx_rebirth_rebuild_legacy.mp3",
  rebirthSettle: "sfx_rebirth_settle_legacy.mp3",
  skillAssemblyLine: "sfx_skill_assembly_line_legacy.mp3",
  skillOverclockGrid: "sfx_skill_overclock_grid_legacy.mp3",
  shopSkillUse: "sfx_shop_skill_use_legacy.mp3",
}

/** Sustain loops are wav (2 s, seamless; mp3 padding would click). Already -10 dBFS, so no gain trim. */
export const LEGACY_LOOP_FILE: Record<GameSfxLoop, string> = {
  assemblyLine: "sfx_skill_assembly_line_loop_legacy.wav",
  overclockGrid: "sfx_skill_overclock_grid_loop_legacy.wav",
}
export const legacyLoopUrl = (loop: GameSfxLoop): string => `${BASE}/${LEGACY_LOOP_FILE[loop]}`

export const legacySfxUrl = (event: GameSfxEvent): string => `${BASE}/${LEGACY_SFX_FILE[event]}`

/** The new effects peak at -1.5 dBFS (the old synth sits far lower), so each gets a trim. */
export const LEGACY_SFX_GAIN: Partial<Record<GameSfxEvent, number>> = {
  uiTap: 0.35,
  uiPurchase: 0.45,
  upgrade: 0.5,
  producerBuy: 0.5,
  coreHit: 0.4,
  coreHitHeavy: 0.5,
  monsterHit: 0.55,
  bossHit: 0.55,
}
export const DEFAULT_LEGACY_SFX_GAIN = 0.65

/** Min gap between two plays of one event (ms), so rapid taps do not stack into noise. */
export const LEGACY_SFX_MIN_GAP: Partial<Record<GameSfxEvent, number>> = {
  uiTap: 45,
  uiPurchase: 60,
  coreHit: 70,
  coreHitHeavy: 90,
  monsterHit: 80,
  bossHit: 80,
  producerBuy: 60,
}

/**
 * Short, click-path samples decoded first on the first gesture (the rest follow one by one, 60 ms apart),
 * so the first clicks never compete with ~40 decodes. Core-tap click pair + the most frequent legacy cues.
 */
export const SFX_PRIORITY_URLS: readonly string[] = [
  "/clicker/audio/sfx_click.ogg",
  "/clicker/audio/sfx_click_crit.ogg",
  legacySfxUrl("coreHit"),
  legacySfxUrl("coreHitHeavy"),
  legacySfxUrl("uiTap"),
  legacySfxUrl("uiPurchase"),
  legacySfxUrl("producerBuy"),
  legacySfxUrl("upgrade"),
  legacySfxUrl("enterMine"),
  legacySfxUrl("exitMine"),
  legacySfxUrl("skillFeverStart"),
  legacySfxUrl("shopSkillUse"),
]
