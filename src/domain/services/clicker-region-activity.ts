import type { RegionActivity, RegionDef } from "../entities/clicker.ts"

/**
 * Each region earns CORE its own way during a timed session. Payouts are in
 * "strike units": one unit = one plain mine strike (click power × fever × event
 * boosts, before combo/crit), so every activity scales with the same upgrades.
 *
 * Balance: under `REFERENCE_PLAYER`, a session in a later region should pay
 * `ACTIVITY_TARGET` × the Core Mine rate, region click multipliers included —
 * travel is worth it, without making earlier regions pointless.
 * `clicker-region-activity.test.ts` holds the numbers to these targets.
 */

export function regionActivity(region: Pick<RegionDef, "activity"> | undefined): RegionActivity {
  return region?.activity ?? "mine"
}

/** Player-facing names: the activity, and the hub button that starts its session. */
export const ACTIVITY_INFO: Record<RegionActivity, { label: string; enter: string }> = {
  mine: { label: "광석 채굴", enter: "Enter Mine" },
  hunt: { label: "몬스터 사냥", enter: "사냥 시작" },
  vault: { label: "금고 해제", enter: "금고 해제" },
}

/* ---------- Mine (Core Mine) — mirrors ClickerMine ---------- */

/** Hits to shatter the center ore (a crit counts as two). */
export const MINE_ORE_HP = 24
/** Extra strikes paid when the ore shatters. */
export const MINE_BREAK_BONUS = 3

/* ---------- Hunt (Signal Relay) ---------- */

export type MonsterKind = "drone" | "wraith" | "brute"

export type MonsterDef = {
  kind: MonsterKind
  name: string
  hp: number
  /** Kill bounty per point of max HP, in strike units. */
  bountyPerHp: number
  /** Escapes (no bounty) if not killed within this long. */
  lifeMs: number
  /** Relative spawn weight. */
  weight: number
  /** Drift speed across the arena, fraction of width per second (0 = hovers in place). */
  speed: number
}

export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  drone: { kind: "drone", name: "신호 드론", hp: 4, bountyPerHp: 1.17, lifeMs: 3200, weight: 6, speed: 0 },
  wraith: { kind: "wraith", name: "잔향 망령", hp: 8, bountyPerHp: 1.32, lifeMs: 4200, weight: 3, speed: 0.08 },
  brute: { kind: "brute", name: "중계 파수꾼", hp: 18, bountyPerHp: 1.5, lifeMs: 6500, weight: 1, speed: 0.03 },
}

/** Every landed hit pays this much on the spot, kill or not. */
export const HUNT_HIT_PAYOUT = 0.5
/** Monsters alive at once; a new one spawns this long after a slot frees. */
export const HUNT_MAX_ALIVE = 3
export const HUNT_RESPAWN_MS = 350

export function huntKillBounty(kind: MonsterKind): number {
  const m = MONSTERS[kind]
  return m.hp * m.bountyPerHp
}

/** Weighted pick; `roll` in [0, 1). */
export function pickMonster(roll: number): MonsterKind {
  const kinds = Object.values(MONSTERS)
  const total = kinds.reduce((s, m) => s + m.weight, 0)
  let acc = 0
  for (const m of kinds) {
    acc += m.weight / total
    if (roll < acc) return m.kind
  }
  return kinds[kinds.length - 1].kind
}

/* ---------- Vault (Phase Vault) ---------- */

/** One needle revolution. */
export const VAULT_PERIOD_MS = 1400
/** Half-widths of the target zone, as a fraction of a revolution. */
export const VAULT_PERFECT_HALF = 0.035
export const VAULT_GOOD_HALF = 0.09
export const VAULT_PAYOUT = { perfect: 5.9, good: 2.9, miss: 0.4 } as const
/** Each consecutive non-miss lock adds this, up to the cap; a miss resets it. */
export const VAULT_CHAIN_STEP = 0.1
export const VAULT_CHAIN_MAX = 5

/** A miss jams the lock this long (taps ignored), so blind spamming can't out-earn timing. */
export const VAULT_MISS_JAM_MS = 450

export type VaultGrade = keyof typeof VAULT_PAYOUT

/** Signed distance around the dial between needle and zone center, in revolutions (-0.5..0.5). */
export function dialOffset(needle: number, zone: number): number {
  let d = (((needle - zone) % 1) + 1) % 1
  if (d > 0.5) d -= 1
  return d
}

export function vaultGrade(needle: number, zone: number): VaultGrade {
  const d = Math.abs(dialOffset(needle, zone))
  if (d <= VAULT_PERFECT_HALF) return "perfect"
  if (d <= VAULT_GOOD_HALF) return "good"
  return "miss"
}

/** Payout for a lock attempt and the chain it leaves behind. */
export function vaultLock(grade: VaultGrade, chain: number): { payout: number; chain: number } {
  if (grade === "miss") return { payout: VAULT_PAYOUT.miss, chain: 0 }
  const bonus = 1 + Math.min(chain, VAULT_CHAIN_MAX) * VAULT_CHAIN_STEP
  return { payout: VAULT_PAYOUT[grade] * bonus, chain: Math.min(chain + 1, VAULT_CHAIN_MAX) }
}

/* ---------- Balance model ---------- */

/** Relative session yield each activity aims for vs. Core Mine (region click multiplier included). */
export const ACTIVITY_TARGET: Record<RegionActivity, number> = { mine: 1, hunt: 1.1, vault: 1.2 }

/**
 * A steady, competent player. Mine taps are free-fire; hunting costs aim
 * (slower, some misses, a few escapes); the vault gates taps on the needle.
 */
export const REFERENCE_PLAYER = {
  critChance: 0.05,
  mineTapsPerSec: 6,
  huntTapsPerSec: 5,
  huntAccuracy: 0.9,
  /** Share of dealt damage that ends in a kill (the rest escapes). */
  huntKillShare: 0.9,
  /** Mean wait for the needle to reach a fresh zone, as a fraction of a revolution. */
  vaultWaitRevs: 0.55,
  vaultGrades: { perfect: 0.6, good: 0.3, miss: 0.1 } as Record<VaultGrade, number>,
}

/** Expected strike units per second for the reference player (before region multipliers). */
export function referenceUnitsPerSecond(activity: RegionActivity, p = REFERENCE_PLAYER): number {
  const dmgPerHit = 1 + p.critChance
  if (activity === "mine") {
    const strikesPerBreak = MINE_ORE_HP / dmgPerHit
    return p.mineTapsPerSec * (1 + MINE_BREAK_BONUS / strikesPerBreak)
  }
  if (activity === "hunt") {
    // Bounty per point of damage, weighted by how much HP each kind brings to the field.
    const kinds = Object.values(MONSTERS)
    const hpWeight = kinds.reduce((s, m) => s + m.weight * m.hp, 0)
    const bountyPerDmg = kinds.reduce((s, m) => s + m.weight * m.hp * m.bountyPerHp, 0) / hpWeight
    const landed = p.huntTapsPerSec * p.huntAccuracy
    return landed * (HUNT_HIT_PAYOUT + dmgPerHit * p.huntKillShare * bountyPerDmg)
  }
  // Vault: chain index k is a capped geometric chain over successful locks.
  const success = 1 - p.vaultGrades.miss
  let chainBonus = 0
  let mass = 0
  for (let k = 0; k <= VAULT_CHAIN_MAX; k++) {
    const pk = k < VAULT_CHAIN_MAX ? (1 - success) * success ** k : success ** VAULT_CHAIN_MAX
    chainBonus += pk * (1 + k * VAULT_CHAIN_STEP)
    mass += pk
  }
  chainBonus /= mass
  const perLock =
    (p.vaultGrades.perfect * VAULT_PAYOUT.perfect + p.vaultGrades.good * VAULT_PAYOUT.good) * chainBonus +
    p.vaultGrades.miss * VAULT_PAYOUT.miss
  const locksPerSec = 1000 / (VAULT_PERIOD_MS * p.vaultWaitRevs)
  return locksPerSec * perLock
}

/** Units per second for someone tapping blindly at `tapsPerSec`, jams included (no chain). */
export function vaultSpamUnitsPerSecond(tapsPerSec: number): number {
  const perfect = 2 * VAULT_PERFECT_HALF
  const good = 2 * (VAULT_GOOD_HALF - VAULT_PERFECT_HALF)
  const miss = 1 - perfect - good
  const attemptsPerSec = 1 / (1 / tapsPerSec + miss * (VAULT_MISS_JAM_MS / 1000))
  return attemptsPerSec * (perfect * VAULT_PAYOUT.perfect + good * VAULT_PAYOUT.good + miss * VAULT_PAYOUT.miss)
}

/** Reference session yield for a region, relative units (activity × region click multiplier). */
export function referenceRegionYield(region: Pick<RegionDef, "activity" | "clickMultiplier">): number {
  return referenceUnitsPerSecond(regionActivity(region)) * (region.clickMultiplier ?? 1)
}
