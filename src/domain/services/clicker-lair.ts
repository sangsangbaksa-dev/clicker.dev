import type { GameConfig, LairFight, MetaState, RunState } from "../entities/clicker"
import { LAIR_STUN_EVERY, lairDamageMultiplier, lairSkills, regionCurrencyBalance, scaledCost, slayMonster, type Rng } from "./clicker-engine.ts"
import { withParticle } from "./clicker-format.ts"

/*
 * Lair battles: instead of tapping a roaming boss to death, the player walks into its lair
 * and fights it. The boss swings back on a fixed rhythm; if the player's HP runs out the
 * boss throws up a shield and can't be challenged again for SHIELD_MS. Weapons (damage per
 * strike), armor (max HP, damage reduction), helmets (max HP) and amulets (slower boss
 * swings) are forged from CORE plus world currencies.
 */

export const LAIR_ATTACK_EVERY_MS = 4200
export const SHIELD_MS = 3 * 60 * 1000
export const BASE_PLAYER_HP = 100

/**
 * Per-boss fight numbers, keyed by monster kind. Each boss is tuned to its own world's gear:
 * with every slot at that world's tier the fight takes ~20-30s at 4-5 taps a second; one tier
 * short and it takes 13+ taps a second, i.e. you forge first.
 */
export const LAIR_BOSSES: Record<string, { hp: number; damage: number }> = {
  golem: { hp: 400, damage: 60 },
  stormbird: { hp: 840, damage: 120 },
  worm: { hp: 1500, damage: 220 },
}

export type GearCost = { core: number; currencies: Array<{ regionId: string; amount: number }> }
export type GearSlot = "weapon" | "armor" | "helmet" | "amulet"
export type GearTier = { id: string; name: string; cost: GearCost }
export type WeaponTier = GearTier & { damage: number }
export type ArmorTier = GearTier & { hp: number; reduction: number }
export type HelmetTier = GearTier & { hp: number }
/** Stretches the boss's attack rhythm by this fraction. */
export type AmuletTier = GearTier & { slow: number }

const cc = (regionId: string, amount: number) => ({ regionId, amount })

/** Tier 0 is what you start with; each tier after that is forged in order. */
export const WEAPONS: WeaponTier[] = [
  { id: "pickaxe", name: "채굴 곡괭이", damage: 1, cost: { core: 0, currencies: [] } },
  { id: "core_blade", name: "코어 강철검", damage: 2, cost: { core: 400, currencies: [cc("signal_relay", 250)] } },
  { id: "phase_greatsword", name: "위상 수정 대검", damage: 4, cost: { core: 6_000, currencies: [cc("signal_relay", 1_500), cc("phase_vault", 2_500)] } },
  { id: "storm_lance", name: "뇌운 창", damage: 7, cost: { core: 75_000, currencies: [cc("phase_vault", 15_000), cc("storm_spire", 22_500)] } },
  { id: "magma_maul", name: "용암 파쇄 망치", damage: 12, cost: { core: 1_250_000, currencies: [cc("storm_spire", 250_000), cc("deep_fault", 350_000)] } },
  // Deep tiers past the last world, matching the armor line.
  { id: "abyss_reaver", name: "심연 낫검", damage: 16, cost: { core: 4_000_000, currencies: [cc("deep_fault", 700_000)] } },
  { id: "obsidian_edge", name: "흑요 절단검", damage: 21, cost: { core: 10_000_000, currencies: [cc("deep_fault", 1_500_000)] } },
  { id: "quake_hammer", name: "지진 전쟁망치", damage: 27, cost: { core: 25_000_000, currencies: [cc("deep_fault", 3_000_000)] } },
  { id: "core_halberd", name: "코어 선봉 미늘창", damage: 34, cost: { core: 60_000_000, currencies: [cc("deep_fault", 6_000_000)] } },
  { id: "worldline_blade", name: "세계선 검", damage: 42, cost: { core: 150_000_000, currencies: [cc("deep_fault", 12_000_000)] } },
]

export const ARMORS: ArmorTier[] = [
  { id: "work_suit", name: "작업복", hp: 0, reduction: 0, cost: { core: 0, currencies: [] } },
  { id: "core_leather", name: "코어 가죽 갑옷", hp: 40, reduction: 0.1, cost: { core: 350, currencies: [cc("signal_relay", 300)] } },
  { id: "phase_cuirass", name: "위상 수정 흉갑", hp: 90, reduction: 0.2, cost: { core: 5_000, currencies: [cc("signal_relay", 1_200), cc("phase_vault", 2_000)] } },
  { id: "storm_plate", name: "뇌운 판금", hp: 160, reduction: 0.3, cost: { core: 60_000, currencies: [cc("phase_vault", 12_500), cc("storm_spire", 20_000)] } },
  { id: "magma_bulwark", name: "용암 요새 갑주", hp: 260, reduction: 0.4, cost: { core: 1_000_000, currencies: [cc("storm_spire", 200_000), cc("deep_fault", 300_000)] } },
  // Deep tiers: forged past the last world, for players who want the lairs to stop hurting.
  { id: "abyss_shell", name: "심연 갑각", hp: 330, reduction: 0.44, cost: { core: 4_000_000, currencies: [cc("deep_fault", 700_000)] } },
  { id: "obsidian_aegis", name: "흑요 아이기스", hp: 410, reduction: 0.48, cost: { core: 10_000_000, currencies: [cc("deep_fault", 1_500_000)] } },
  { id: "quake_fortress", name: "지진 성채 갑주", hp: 500, reduction: 0.52, cost: { core: 25_000_000, currencies: [cc("deep_fault", 3_000_000)] } },
  { id: "core_vanguard", name: "코어 선봉 갑주", hp: 600, reduction: 0.56, cost: { core: 60_000_000, currencies: [cc("deep_fault", 6_000_000)] } },
  { id: "worldline_armor", name: "세계선 갑주", hp: 720, reduction: 0.6, cost: { core: 150_000_000, currencies: [cc("deep_fault", 12_000_000)] } },
]

export const HELMETS: HelmetTier[] = [
  { id: "miner_helmet", name: "광부 헬멧", hp: 0, cost: { core: 0, currencies: [] } },
  { id: "core_visor", name: "코어 강화 투구", hp: 20, cost: { core: 250, currencies: [cc("signal_relay", 200)] } },
  { id: "phase_crown", name: "위상 수정 관", hp: 50, cost: { core: 3_500, currencies: [cc("signal_relay", 900), cc("phase_vault", 1_400)] } },
  { id: "storm_helm", name: "뇌운 투구", hp: 90, cost: { core: 42_500, currencies: [cc("phase_vault", 9_000), cc("storm_spire", 14_000)] } },
  { id: "magma_horns", name: "용암 뿔 투구", hp: 150, cost: { core: 700_000, currencies: [cc("storm_spire", 140_000), cc("deep_fault", 210_000)] } },
  // Deep tiers past the last world, matching the armor line.
  { id: "abyss_mask", name: "심연 가면", hp: 190, cost: { core: 4_000_000, currencies: [cc("deep_fault", 700_000)] } },
  { id: "obsidian_helm", name: "흑요 투구", hp: 240, cost: { core: 10_000_000, currencies: [cc("deep_fault", 1_500_000)] } },
  { id: "quake_crown", name: "지진 왕관", hp: 300, cost: { core: 25_000_000, currencies: [cc("deep_fault", 3_000_000)] } },
  { id: "core_vanguard_helm", name: "코어 선봉 투구", hp: 370, cost: { core: 60_000_000, currencies: [cc("deep_fault", 6_000_000)] } },
  { id: "worldline_helm", name: "세계선 투구", hp: 450, cost: { core: 150_000_000, currencies: [cc("deep_fault", 12_000_000)] } },
]

export const AMULETS: AmuletTier[] = [
  { id: "faded_charm", name: "빛바랜 부적", slow: 0, cost: { core: 0, currencies: [] } },
  { id: "signal_charm", name: "신호 증폭 부적", slow: 0.1, cost: { core: 500, currencies: [cc("signal_relay", 350)] } },
  { id: "phase_hourglass", name: "위상 모래시계", slow: 0.2, cost: { core: 7_500, currencies: [cc("signal_relay", 1_800), cc("phase_vault", 3_000)] } },
  { id: "storm_eye", name: "폭풍의 눈", slow: 0.3, cost: { core: 90_000, currencies: [cc("phase_vault", 18_000), cc("storm_spire", 27_000)] } },
  { id: "magma_heartstone", name: "용암 심장석", slow: 0.45, cost: { core: 1_500_000, currencies: [cc("storm_spire", 300_000), cc("deep_fault", 420_000)] } },
  // Deep tiers past the last world, matching the armor line.
  { id: "abyss_eye", name: "심연의 눈", slow: 0.55, cost: { core: 4_000_000, currencies: [cc("deep_fault", 700_000)] } },
  { id: "obsidian_sigil", name: "흑요 인장", slow: 0.65, cost: { core: 10_000_000, currencies: [cc("deep_fault", 1_500_000)] } },
  { id: "quake_compass", name: "지진 나침반", slow: 0.75, cost: { core: 25_000_000, currencies: [cc("deep_fault", 3_000_000)] } },
  { id: "core_reliquary", name: "코어 성물함", slow: 0.85, cost: { core: 60_000_000, currencies: [cc("deep_fault", 6_000_000)] } },
  { id: "worldline_hourglass", name: "세계선 모래시계", slow: 1, cost: { core: 150_000_000, currencies: [cc("deep_fault", 12_000_000)] } },
]

export const GEAR: Record<GearSlot, GearTier[]> = { weapon: WEAPONS, armor: ARMORS, helmet: HELMETS, amulet: AMULETS }
export const GEAR_SLOTS: GearSlot[] = ["weapon", "armor", "helmet", "amulet"]

/** Painted icon for a gear tier. */
export function gearImage(tier: GearTier): string {
  return `/clicker/gear/${tier.id}.webp`
}

export function gearOf(run: RunState): Record<GearSlot, number> {
  const at = (slot: GearSlot) => Math.min(GEAR[slot].length - 1, Math.max(0, run.gear?.[slot] ?? 0))
  return { weapon: at("weapon"), armor: at("armor"), helmet: at("helmet"), amulet: at("amulet") }
}

export function playerMaxHp(run: RunState): number {
  const g = gearOf(run)
  return BASE_PLAYER_HP + ARMORS[g.armor].hp + HELMETS[g.helmet].hp
}

/** How often the boss swings, stretched by the amulet. */
export function lairAttackEveryMs(run: RunState): number {
  return Math.round(LAIR_ATTACK_EVERY_MS * (1 + AMULETS[gearOf(run).amulet].slow))
}

export function shieldRemainingMs(run: RunState, regionId: string, now: number): number {
  return Math.max(0, (run.monsterShieldUntil?.[regionId] ?? 0) - now)
}

/** Why forging the next tier is refused, or undefined when it can be forged. */
export function forgeError(run: RunState, config: GameConfig, slot: GearSlot): string | undefined {
  const next = GEAR[slot][gearOf(run)[slot] + 1]
  if (!next) return "최고 등급입니다."
  if (run.coreEnergy < scaledCost(run, next.cost.core)) return "CORE가 부족합니다."
  for (const c of next.cost.currencies) {
    if (regionCurrencyBalance(run, c.regionId) < c.amount) {
      const name = config.regions.find((r) => r.id === c.regionId)?.currency?.name ?? c.regionId
      return `${withParticle(name, "이가")} 부족합니다.`
    }
  }
  return undefined
}

/*
 * Forging is an enhancement roll, modelled on MMO honing tables (Lost Ark's honing rates and
 * artisan's energy, MapleStory's falling star-force odds): early tiers always land, deep tiers
 * are a gamble. Every attempt costs the full price. A failure keeps the current tier, raises
 * the next attempt's odds by 10% of the base rate (up to double), and fills artisan's energy
 * by 46.5% of the odds just rolled — at 100% energy the next attempt cannot fail.
 */

/** Base success rate for forging INTO tier i (index 0 is the starter gear, never forged). */
export const FORGE_SUCCESS_RATES = [1, 1, 0.95, 0.85, 0.75, 0.6, 0.5, 0.4, 0.3, 0.2] as const
export const FORGE_FAIL_BONUS = 0.1
export const FORGE_ENERGY_PER_FAIL = 0.465

export type ForgeOdds = {
  /** Base rate from the table. */
  base: number
  /** This attempt's rate after failure bonuses (1 when energy is full). */
  rate: number
  /** Artisan's energy, 0..1. */
  energy: number
  fails: number
  guaranteed: boolean
}

function forgeFails(run: RunState, slot: GearSlot): number {
  const n = run.forgeFails?.[slot] ?? 0
  return Number.isInteger(n) && n > 0 ? n : 0
}

/** Odds for forging the next tier of a slot; undefined at the top tier. */
export function forgeOdds(run: RunState, slot: GearSlot): ForgeOdds | undefined {
  const target = gearOf(run)[slot] + 1
  if (!GEAR[slot][target]) return undefined
  const base = FORGE_SUCCESS_RATES[Math.min(target, FORGE_SUCCESS_RATES.length - 1)]
  const rateAfter = (k: number) => Math.min(1, base * 2, base * (1 + FORGE_FAIL_BONUS * k))
  const fails = forgeFails(run, slot)
  let energy = 0
  for (let k = 0; k < fails; k++) energy += rateAfter(k) * FORGE_ENERGY_PER_FAIL
  energy = Math.min(1, energy)
  const guaranteed = energy >= 1 - 1e-9
  return { base, rate: guaranteed ? 1 : rateAfter(fails), energy, fails, guaranteed }
}

export function forgeGear(
  run: RunState,
  config: GameConfig,
  slot: GearSlot,
  rng: Rng = () => 0,
): { run: RunState; error?: string; success?: boolean } {
  if (run.lair) return { run, error: "전투 중에는 제작할 수 없습니다." }
  const error = forgeError(run, config, slot)
  if (error) return { run, error }
  const gear = gearOf(run)
  const next = GEAR[slot][gear[slot] + 1]
  const odds = forgeOdds(run, slot)!
  const regionCurrency = { ...run.regionCurrency }
  for (const c of next.cost.currencies) regionCurrency[c.regionId] = regionCurrencyBalance(run, c.regionId) - c.amount
  const paid: RunState = { ...run, coreEnergy: run.coreEnergy - scaledCost(run, next.cost.core), regionCurrency }
  const success = odds.guaranteed || rng() < odds.rate
  if (!success) return { run: { ...paid, forgeFails: { ...run.forgeFails, [slot]: odds.fails + 1 } }, success: false }
  return {
    run: { ...paid, gear: { ...gear, [slot]: gear[slot] + 1 }, forgeFails: { ...run.forgeFails, [slot]: 0 } },
    success: true,
  }
}

/** Walk into the lair of the current region's boss. */
export function enterLair(run: RunState, config: GameConfig, now: number): { run: RunState; error?: string } {
  const region = config.regions.find((r) => r.id === run.currentRegionId)
  const monster = region?.monster
  const stats = monster && LAIR_BOSSES[monster.kind]
  if (!region || !monster || !stats) return { run, error: "여기에는 토벌할 보스가 없습니다." }
  if (run.lair) return { run }
  if ((run.monsterRespawnAt[region.id] ?? 0) > now) return { run, error: "보스가 아직 돌아오지 않았습니다." }
  const shield = shieldRemainingMs(run, region.id, now)
  if (shield > 0) return { run, error: `보호막 · ${Math.ceil(shield / 1000)}초 후 도전 가능` }
  const hp = playerMaxHp(run)
  const lair: LairFight = {
    regionId: region.id,
    bossHp: stats.hp,
    bossMaxHp: stats.hp,
    playerHp: hp,
    playerMaxHp: hp,
    nextAttackAt: now + lairAttackEveryMs(run),
    strikes: 0,
  }
  return { run: { ...run, lair } }
}

export function leaveLair(run: RunState): RunState {
  return run.lair ? { ...run, lair: null } : run
}

/** Monster-only skills that went off on a strike. */
export type LairProcs = { quake: boolean; weakSpot: boolean; stun: boolean; healed: number }
const NO_PROCS: LairProcs = { quake: false, weakSpot: false, stun: false, healed: 0 }

/**
 * One strike with the forged weapon. The HUNT tree's monster-only skills ride on it: a
 * shockwave every Nth strike, a weak-spot hit by chance, lifesteal and a stun that pushes the
 * creature's next swing back. The killing blow pays out like the old tap-kill.
 */
export function strikeLair(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  now: number,
  rng: Rng = () => 1,
): { run: RunState; meta: MetaState; damage: number; reward: number; defeated: boolean; procs: LairProcs } {
  const fight = run.lair
  if (!fight || fight.playerHp <= 0 || fight.bossHp <= 0) return { run, meta, damage: 0, reward: 0, defeated: false, procs: NO_PROCS }
  // Forged weapon × the HUNT tree's creature-damage circuits, whole numbers so the HP bar reads cleanly.
  const base = WEAPONS[gearOf(run).weapon].damage * lairDamageMultiplier(run, config)
  const skills = lairSkills(run, config)
  const strikes = (fight.strikes ?? 0) + 1
  const quake = skills.quakeMultiplier > 0 && strikes % skills.quakeInterval === 0
  const weakSpot = skills.critChance > 0 && rng() < skills.critChance
  const stun = skills.stunMs > 0 && strikes % LAIR_STUN_EVERY === 0
  const raw = base * (weakSpot ? skills.critMultiplier : 1) + (quake ? base * skills.quakeMultiplier : 0)
  const damage = Math.max(1, Math.round(raw))
  const playerHp = Math.min(fight.playerMaxHp, fight.playerHp + Math.round(fight.playerMaxHp * skills.lifesteal))
  const procs: LairProcs = { quake, weakSpot, stun, healed: playerHp - fight.playerHp }
  const bossHp = Math.max(0, fight.bossHp - damage)
  if (bossHp > 0) {
    const nextAttackAt = stun ? fight.nextAttackAt + skills.stunMs : fight.nextAttackAt
    return { run: { ...run, lair: { ...fight, bossHp, playerHp, nextAttackAt, strikes } }, meta, damage, reward: 0, defeated: false, procs }
  }
  const kill = slayMonster({ ...run, lair: null }, meta, config, fight.regionId, now)
  return { run: kill.run, meta: kill.meta, damage, reward: kill.reward, defeated: true, procs }
}

/**
 * The boss swings on its timer. When the player drops to 0 HP the fight ends and the
 * boss is shielded for SHIELD_MS.
 */
export function tickLair(run: RunState, config: GameConfig, now: number): RunState {
  const fight = run.lair
  if (!fight) return run
  if (run.currentRegionId !== fight.regionId) return { ...run, lair: null }
  const kind = config.regions.find((r) => r.id === fight.regionId)?.monster?.kind
  const stats = kind ? LAIR_BOSSES[kind] : undefined
  if (!stats) return { ...run, lair: null }
  const hitFor = Math.round(stats.damage * (1 - ARMORS[gearOf(run).armor].reduction))
  let { playerHp, nextAttackAt } = fight
  while (now >= nextAttackAt && playerHp > 0) {
    playerHp -= hitFor
    nextAttackAt += lairAttackEveryMs(run)
  }
  if (playerHp <= 0) {
    return {
      ...run,
      lair: null,
      monsterShieldUntil: { ...run.monsterShieldUntil, [fight.regionId]: now + SHIELD_MS },
    }
  }
  if (playerHp === fight.playerHp) return run
  return { ...run, lair: { ...fight, playerHp, nextAttackAt } }
}
