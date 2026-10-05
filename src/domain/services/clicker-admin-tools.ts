import type { GameConfig, RunState, SaveData } from "../entities/clicker.ts"
import { regionUnlockThreshold, startBossFight } from "./clicker-engine.ts"

/** Client-only admin switches (not saved). */
export type AdminModes = {
  god: boolean
  speed: number
}

export const ADMIN_SPEEDS = [1, 2, 5, 10] as const
export const ADMIN_DEFAULT_MODES: AdminModes = { god: false, speed: 1 }

export function nextAdminSpeed(speed: number): number {
  const i = ADMIN_SPEEDS.indexOf(speed as (typeof ADMIN_SPEEDS)[number])
  return ADMIN_SPEEDS[(i + 1) % ADMIN_SPEEDS.length]
}

export function adminGrantCurrencies(run: RunState, config: GameConfig, amount: number): RunState {
  const wallet = { ...run.regionCurrency }
  for (const r of config.regions) if (r.currency) wallet[r.id] = (wallet[r.id] ?? 0) + amount
  return { ...run, regionCurrency: wallet }
}

/** Secret code typed anywhere in the game (see `clickerRedeemSecretCode`). */
export const SECRET_CODE = "@kk960398"
/** What the secret code grants: this much CORE and of every world currency. */
export const SECRET_CODE_AMOUNT = 1e14

/** True when the latest typed characters spell the secret code. */
export function typedSecretCode(buffer: string): boolean {
  return buffer.endsWith(SECRET_CODE)
}

/** CORE to spend (not lifetime, so it opens nothing on its own) plus every world currency. */
export function grantSecretCode(run: RunState, config: GameConfig): RunState {
  return { ...adminGrantCurrencies(run, config, SECRET_CODE_AMOUNT), coreEnergy: run.coreEnergy + SECRET_CODE_AMOUNT }
}

export function finalBossRegionId(config: GameConfig): string | undefined {
  return [...config.regions].reverse().find((r) => r.boss)?.id
}

export function adminJumpToFinalBoss(save: SaveData, config: GameConfig, now: number): SaveData {
  const id = finalBossRegionId(config)
  const region = config.regions.find((r) => r.id === id)
  if (!region) return save
  const base: RunState = {
    ...save.runState,
    currentWorldLine: Math.max(save.runState.currentWorldLine, (region.requiresRebirths ?? 0) + 1),
  }
  const unlocked: RunState = {
    ...base,
    lifetimeCoreEnergy: Math.max(base.lifetimeCoreEnergy, regionUnlockThreshold(base, config, region)),
    currentRegionId: region.id,
    lair: null,
    boss: null,
    crisisActive: false,
    mineSessionEndsAt: 0,
  }
  const fight = startBossFight(unlocked, config, now)
  return {
    ...save,
    settings: { ...save.settings, gameStarted: true, tutorialSeen: true, playSurface: "hub" },
    metaState: save.metaState.visitedRegionIds.includes(region.id)
      ? save.metaState
      : { ...save.metaState, visitedRegionIds: [...save.metaState.visitedRegionIds, region.id] },
    runState: fight.run,
  }
}

export function adminReplayTutorial(save: SaveData): SaveData {
  return { ...save, settings: { ...save.settings, tutorialSeen: false } }
}

export function applyGodMode(prev: RunState, next: RunState): RunState {
  let out = next
  if (next.boss && next.boss.playerHp < next.boss.playerMaxHp) out = { ...out, boss: { ...next.boss, playerHp: next.boss.playerMaxHp } }
  if (next.lair && next.lair.playerHp < next.lair.playerMaxHp) out = { ...out, lair: { ...next.lair, playerHp: next.lair.playerMaxHp } }
  if (prev.boss && !next.boss && prev.boss.playerHp <= 0) out = { ...out, boss: prev.boss }
  return out
}

export function applySpeedBoost(prev: RunState, next: RunState, speed: number): RunState {
  if (speed <= 1) return next
  const gained = next.coreEnergy - prev.coreEnergy
  if (!(gained > 0)) return next
  const extra = gained * (speed - 1)
  return { ...next, coreEnergy: next.coreEnergy + extra, lifetimeCoreEnergy: next.lifetimeCoreEnergy + extra }
}

export function clampTutorialStep(step: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(0, Math.floor(step)), length - 1)
}

export const ADMIN_SECRET_TAPS = 7
export const ADMIN_SECRET_WINDOW_MS = 4000
export type SecretTapState = { count: number; first: number }

export function registerSecretTap(state: SecretTapState, now: number): { state: SecretTapState; unlocked: boolean } {
  const fresh = state.count === 0 || now - state.first > ADMIN_SECRET_WINDOW_MS
  const next: SecretTapState = fresh ? { count: 1, first: now } : { count: state.count + 1, first: state.first }
  if (next.count >= ADMIN_SECRET_TAPS) return { state: { count: 0, first: 0 }, unlocked: true }
  return { state: next, unlocked: false }
}
