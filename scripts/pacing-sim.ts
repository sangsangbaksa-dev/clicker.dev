/**
 * Pacing simulation: a scripted player on the real engine + catalog.
 * Policy: 10s mine sessions at CLICKS_PER_SEC (+ ore-shatter bonus strikes), 30s cooldown,
 * and greedy "buy the cheapest affordable thing" (producer level / upgrade / skill node) every second.
 * Run: node --experimental-strip-types scripts/pacing-sim.ts [clicksPerSec]
 */
import { clickerConfig as config } from "../src/data/clicker/catalog.ts"
import {
  buyProducer,
  buySkillNode,
  buyUpgrade,
  createInitialSave,
  enterClickerMine,
  isProducerUnlocked,
  processClick,
  processTick,
  producerCost,
  syncClickerMineSession,
} from "../src/domain/services/clicker-engine.ts"
import { awardAchievements } from "../src/domain/services/clicker-bonus.ts"

const CLICKS_PER_SEC = Number(process.argv[2] ?? 6)
const HOURS = 3
let seed = 7
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

let now = 1_000_000
let save = { ...createInitialSave(now, config), settings: { ...createInitialSave(now, config).settings, gameStarted: true } }
const marks: Record<string, number> = {}
const mark = (key: string) => {
  if (marks[key] == null) marks[key] = (now - 1_000_000) / 1000
}
let hits = 0

function buyCheapest(): boolean {
  const run = save.runState
  const options: { cost: number; apply: () => void; label: string }[] = []
  for (const p of config.producers) {
    if (!isProducerUnlocked(run, config, p.id)) continue
    const cost = producerCost(config, p.id, run.producerLevels[p.id] ?? 0)
    options.push({ cost, label: `producer`, apply: () => (save = { ...save, runState: buyProducer(run, save.metaState, config, p.id, 1).run }) })
  }
  for (const u of config.upgrades) {
    if (run.ownedUpgradeIds.includes(u.id)) continue
    const res = buyUpgrade(run, config, u.id)
    if (res.error && res.error !== "CORE가 부족합니다.") continue
    options.push({ cost: u.cost, label: "upgrade", apply: () => (save = { ...save, runState: buyUpgrade(run, config, u.id).run }) })
  }
  for (const n of config.skillNodes) {
    if (n.branch === "TRANSCENDENCE" || run.ownedSkillNodeIds.includes(n.id)) continue
    if ((n.requires ?? []).some((id) => !run.ownedSkillNodeIds.includes(id))) continue
    options.push({ cost: n.cost, label: "skill", apply: () => (save = { ...save, runState: buySkillNode(run, config, n.id).run }) })
  }
  options.sort((a, b) => a.cost - b.cost)
  const pick = options[0]
  if (!pick || pick.cost > run.coreEnergy) return false
  pick.apply()
  mark(`first ${pick.label}`)
  return true
}

const end = now + HOURS * 3600_000
while (now < end) {
  // Enter the mine whenever allowed.
  if (save.settings.playSurface !== "mine") {
    const entered = enterClickerMine(save, now, config)
    if (!entered.error) save = entered.save
  }
  for (let step = 0; step < 10; step++) {
    now += 100
    save = syncClickerMineSession(save, now)
    if (save.settings.playSurface === "mine" && step % Math.max(1, Math.round(10 / CLICKS_PER_SEC)) === 0) {
      const strikes = CLICKS_PER_SEC >= 10 ? Math.round(CLICKS_PER_SEC / 10) : 1
      for (let i = 0; i < strikes; i++) {
        const c = processClick(save.runState, save.metaState, config, now, rng)
        save = { ...save, runState: c.run, metaState: c.meta }
        hits += 1
        if (hits % 24 === 0) {
          for (let b = 0; b < 3; b++) {
            const bonus = processClick(save.runState, save.metaState, config, now, rng)
            save = { ...save, runState: bonus.run, metaState: bonus.meta }
          }
        }
      }
    }
  }
  const t = processTick(save.runState, save.metaState, config, now)
  save = { ...save, runState: t.run, metaState: t.meta }
  save = { ...save, metaState: awardAchievements(save.runState, save.metaState, config.achievements).meta }
  while (buyCheapest()) {}
  const life = save.runState.lifetimeCoreEnergy
  for (const [label, target] of [["10K", 1e4], ["100K", 1e5], ["1M", 1e6], ["REBIRTH 10M", config.rebirthEnergy]] as const) {
    if (life >= target) mark(label)
  }
  if (life >= config.rebirthEnergy) break
}

const fmt = (s: number) => `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
console.log(`clicks/s=${CLICKS_PER_SEC}`)
for (const [k, v] of Object.entries(marks).sort((a, b) => a[1] - b[1])) console.log(`${k.padEnd(16)} ${fmt(v)}`)
console.log(`achievements     ${save.metaState.achievementIds.length}`)
