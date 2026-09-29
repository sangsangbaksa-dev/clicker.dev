import type { GameConfig, LairFight, MetaState, RunState } from "../entities/clicker"
import { regionCurrencyBalance, scaledCost, slayMonster } from "./clicker-engine.ts"

/*
 * Lair battles: instead of tapping a roaming boss to death, the player walks into its lair
 * and fights it. The boss swings back on a fixed rhythm; if the player's HP runs out the
 * boss throws up a shield and can't be challenged again for SHIELD_MS. Weapons (damage per
 * strike) and armor (max HP, damage reduction) are forged from CORE plus world currencies.
 */

export const LAIR_ATTACK_EVERY_MS = 4200
export const SHIELD_MS = 3 * 60 * 1000
export const BASE_PLAYER_HP = 100

/** Per-boss fight numbers, keyed by monster kind. */
export const LAIR_BOSSES: Record<string, { hp: number; damage: number }> = {
  golem: { hp: 24, damage: 22 },
  stormbird: { hp: 40, damage: 28 },
  worm: { hp: 60, damage: 34 },
}

export type GearCost = { core: number; currencies: Array<{ regionId: string; amount: number }> }
export type GearTier = { name: string; icon: string; cost: GearCost }
export type WeaponTier = GearTier & { damage: number }
export type ArmorTier = GearTier & { hp: number; reduction: number }

const cc = (regionId: string, amount: number) => ({ regionId, amount })

/** Tier 0 is what you start with; each tier after that is forged in order. */
export const WEAPONS: WeaponTier[] = [
  { name: "채굴 곡괭이", icon: "⛏️", damage: 1, cost: { core: 0, currencies: [] } },
  { name: "코어 강철검", icon: "🗡️", damage: 2, cost: { core: 400, currencies: [cc("signal_relay", 250)] } },
  { name: "위상 수정 대검", icon: "⚔️", damage: 4, cost: { core: 6_000, currencies: [cc("signal_relay", 1_500), cc("phase_vault", 2_500)] } },
  { name: "뇌운 창", icon: "🔱", damage: 7, cost: { core: 150_000, currencies: [cc("phase_vault", 30_000), cc("storm_spire", 45_000)] } },
  { name: "용암 파쇄 망치", icon: "🔨", damage: 12, cost: { core: 2_500_000, currencies: [cc("storm_spire", 500_000), cc("deep_fault", 700_000)] } },
]

export const ARMORS: ArmorTier[] = [
  { name: "작업복", icon: "🧥", hp: 0, reduction: 0, cost: { core: 0, currencies: [] } },
  { name: "코어 가죽 갑옷", icon: "🦺", hp: 40, reduction: 0.1, cost: { core: 350, currencies: [cc("signal_relay", 300)] } },
  { name: "위상 수정 흉갑", icon: "🛡️", hp: 90, reduction: 0.2, cost: { core: 5_000, currencies: [cc("signal_relay", 1_200), cc("phase_vault", 2_000)] } },
  { name: "뇌운 판금", icon: "🪖", hp: 160, reduction: 0.3, cost: { core: 120_000, currencies: [cc("phase_vault", 25_000), cc("storm_spire", 40_000)] } },
  { name: "용암 요새 갑주", icon: "🏰", hp: 260, reduction: 0.4, cost: { core: 2_000_000, currencies: [cc("storm_spire", 400_000), cc("deep_fault", 600_000)] } },
]

export function gearOf(run: RunState): { weapon: number; armor: number } {
  return {
    weapon: Math.min(WEAPONS.length - 1, run.gear?.weapon ?? 0),
    armor: Math.min(ARMORS.length - 1, run.gear?.armor ?? 0),
  }
}

export function playerMaxHp(run: RunState): number {
  return BASE_PLAYER_HP + ARMORS[gearOf(run).armor].hp
}

export function shieldRemainingMs(run: RunState, regionId: string, now: number): number {
  return Math.max(0, (run.monsterShieldUntil?.[regionId] ?? 0) - now)
}

/** Why forging the next tier is refused, or undefined when it can be forged. */
export function forgeError(run: RunState, config: GameConfig, slot: "weapon" | "armor"): string | undefined {
  const list = slot === "weapon" ? WEAPONS : ARMORS
  const next = list[gearOf(run)[slot] + 1]
  if (!next) return "최고 등급입니다."
  if (run.coreEnergy < scaledCost(run, next.cost.core)) return "CORE가 부족합니다."
  for (const c of next.cost.currencies) {
    if (regionCurrencyBalance(run, c.regionId) < c.amount) {
      const name = config.regions.find((r) => r.id === c.regionId)?.currency?.name ?? c.regionId
      return `${name}이(가) 부족합니다.`
    }
  }
  return undefined
}

export function forgeGear(run: RunState, config: GameConfig, slot: "weapon" | "armor"): { run: RunState; error?: string } {
  if (run.lair) return { run, error: "전투 중에는 제작할 수 없습니다." }
  const error = forgeError(run, config, slot)
  if (error) return { run, error }
  const gear = gearOf(run)
  const next = (slot === "weapon" ? WEAPONS : ARMORS)[gear[slot] + 1]
  const regionCurrency = { ...run.regionCurrency }
  for (const c of next.cost.currencies) regionCurrency[c.regionId] = regionCurrencyBalance(run, c.regionId) - c.amount
  return {
    run: {
      ...run,
      coreEnergy: run.coreEnergy - scaledCost(run, next.cost.core),
      regionCurrency,
      gear: { ...gear, [slot]: gear[slot] + 1 },
    },
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
    nextAttackAt: now + LAIR_ATTACK_EVERY_MS,
  }
  return { run: { ...run, lair } }
}

export function leaveLair(run: RunState): RunState {
  return run.lair ? { ...run, lair: null } : run
}

/** One strike with the forged weapon. The killing blow pays out like the old tap-kill. */
export function strikeLair(
  run: RunState,
  meta: MetaState,
  config: GameConfig,
  now: number,
): { run: RunState; meta: MetaState; damage: number; reward: number; defeated: boolean } {
  const fight = run.lair
  if (!fight || fight.playerHp <= 0 || fight.bossHp <= 0) return { run, meta, damage: 0, reward: 0, defeated: false }
  const damage = WEAPONS[gearOf(run).weapon].damage
  const bossHp = Math.max(0, fight.bossHp - damage)
  if (bossHp > 0) return { run: { ...run, lair: { ...fight, bossHp } }, meta, damage, reward: 0, defeated: false }
  const kill = slayMonster({ ...run, lair: null }, meta, config, fight.regionId, now)
  return { run: kill.run, meta: kill.meta, damage, reward: kill.reward, defeated: true }
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
    nextAttackAt += LAIR_ATTACK_EVERY_MS
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
