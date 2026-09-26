/**
 * Full-playthrough simulation on the real engine + catalog: every worldline from a fresh
 * save to the true ending (all transcendence buffs walked once).
 *
 * Player model: mine sessions back-to-back at CLICKS_PER_SEC (+ assist drill strikes),
 * golden veins claimed when they spawn, region activities used when ready (then back home,
 * where the mine is), field challenges at 80% success, monster hunts played by a scripted
 * hunter (HUNTER_TAPS taps/s, 85% accuracy), and a
 * payback-greedy shopper (producer level / upgrade / skill node with the best
 * cost ÷ income gain, cheap utility nodes bought outright). Potions and crisis are ignored,
 * so a real player lands a little faster than this.
 *
 * Run: node --experimental-strip-types scripts/playtime-sim.ts [clicksPerSec]
 */
import { clickerConfig as config } from "../src/data/clicker/catalog.ts"
import type { SaveData } from "../src/domain/entities/clicker.ts"
import {
  applyRebirth,
  buyProducer,
  buySkillNode,
  buyUpgrade,
  canRebirth,
  canTriggerTrueEnding,
  createInitialSave,
  derivedClick,
  droneEnergyPerSecond,
  enterClickerMine,
  isProducerUnlocked,
  isRegionUnlocked,
  isSkillNodeVisible,
  processClick,
  processTick,
  producerCost,
  productionSnapshot,
  rebirthRequirement,
  scaledCost,
  startFever,
  regionActivityReady,
  strikeStats,
  syncClickerMineSession,
  travelToRegion,
  homeRegionId,
  returnHomeRegion,
  activateRegion,
  claimRegionChallenge,
  regionChallengeError,
  claimRegionHunt,
  regionHuntError,
} from "../src/domain/services/clicker-engine.ts"
import { autoplayHunt, huntCritChance, huntPower, summarizeHunt } from "../src/domain/services/clicker-hunt.ts"
import { autoDrillRate, awardAchievements, claimGoldenVein, VEIN_SPAWN_CHANCE } from "../src/domain/services/clicker-bonus.ts"

const CLICKS_PER_SEC = Number(process.argv[2] ?? 6)
// Tuning knobs (env): scale skill costs / producer costs, override rebirth growth or worldline bonus.
const knob = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d)
// TIERED: price multiplier falls from HI (cheap items) to LO (items costing ≥ PIVOT), log-linear.
const tiered = (cost: number, hi: number, lo: number, pivot: number) => {
  const t = Math.min(1, Math.max(0, Math.log10(Math.max(cost, 1e3) / 1e3) / Math.log10(pivot / 1e3)))
  return cost * hi ** (1 - t) * lo ** t
}
if (process.env.TIERED) {
  const [shi, slo, uhi, ulo, phi, plo, pivot] = process.env.TIERED.split(",").map(Number)
  for (const n of config.skillNodes) n.cost = tiered(n.cost, shi, slo, pivot)
  for (const u of config.upgrades) u.cost = tiered(u.cost, uhi, ulo, pivot)
  config.producers.forEach((p, i) => {
    const m = phi ** (1 - i / (config.producers.length - 1)) * plo ** (i / (config.producers.length - 1))
    p.baseCost *= m
    p.unlockAt *= m
  })
}
for (const n of config.skillNodes) n.cost = Math.round(n.cost * knob("SKILL_COST", 1))
for (const u of config.upgrades) u.cost = Math.round(u.cost * knob("UPG_COST", 1))
for (const p of config.producers) {
  p.baseCost *= knob("PROD_COST", 1)
  p.costGrowth += knob("COST_GROWTH_ADD", 0)
  p.productionPerSecond *= knob("PROD_RATE", 1)
}
config.rebirthGrowth = knob("GROWTH", config.rebirthGrowth)
config.priceGrowth = knob("PRICE", config.priceGrowth)
config.worldlineBonus = knob("WL", config.worldlineBonus)
config.rebirthEnergy = knob("GOAL", config.rebirthEnergy)
if (process.env.NO_ACT) for (const r of config.regions) delete r.activity
if (process.env.NO_BURST) for (const r of config.regions) if (r.activity?.kind === "PRODUCTION_BURST") delete r.activity
for (const t of config.transcendence) {
  if (t.clickMultiplier) t.clickMultiplier **= knob("BUFF_POW", 1)
  if (t.productionMultiplier) t.productionMultiplier **= knob("BUFF_POW", 1)
}
const MAX_HOURS = 6
let seed = 11
const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647

const START = 1_000_000
let now = START
let save: SaveData = createInitialSave(now, config)
save = { ...save, settings: { ...save.settings, gameStarted: true } }
const elapsed = () => (now - START) / 1000
const fmt = (s: number) => `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, "0")}s`

/** Rough CORE/s the player earns: production + drones + mining at the mine duty cycle. */
function income(s: SaveData): number {
  const run = s.runState
  const meta = s.metaState
  const prod = productionSnapshot(run, meta, config, now).perSecond
  const d = derivedClick(run, meta, config)
  const st = strikeStats(run, config)
  const crit = Math.min(d.critChance, 0.85)
  let perClick = d.click * 1.3 * (1 + crit * (d.critMult - 1))
  perClick *=
    1 +
    st.echoChance +
    st.lightningChance * st.lightningMultiplier * (1 + 0.5 * st.lightningChains) +
    (st.quakeMultiplier > 0 ? st.quakeMultiplier / st.quakeInterval : 0)
  const sessionSec = 10 + config.skillNodes.filter((n) => run.ownedSkillNodeIds.includes(n.id)).reduce((a, n) => a + (n.mineSessionSecondsAdd ?? 0), 0)
  const duty = sessionSec / (sessionSec + 20)
  const drill = config.skillNodes.filter((n) => run.ownedSkillNodeIds.includes(n.id)).reduce((a, n) => a + (n.autoDrillPerSecond ?? 0), 0)
  return prod + droneEnergyPerSecond(run, meta, config) + perClick * (CLICKS_PER_SEC + drill) * duty
}

type Option = { cost: number; score: number; apply: () => SaveData }

function shop(): void {
  for (let guard = 0; guard < 400; guard++) {
    const run = save.runState
    const base = income(save)
    const options: Option[] = []
    const consider = (cost: number, next: SaveData) => {
      const gain = income(next) - base
      // Utility nodes (fever, finisher, mine time, carry-over) don't move the estimate: buy when cheap.
      const score = gain > 1e-9 ? cost / gain : cost <= base * 45 ? 0 : Infinity
      return score
    }
    for (const p of config.producers) {
      if (!isProducerUnlocked(run, config, p.id)) continue
      const cost = producerCost(config, p.id, run.producerLevels[p.id] ?? 0, run.costScale)
      const levels = { ...run.producerLevels, [p.id]: (run.producerLevels[p.id] ?? 0) + 1 }
      const next = { ...save, runState: { ...run, producerLevels: levels } }
      options.push({ cost, score: consider(cost, next), apply: () => ({ ...save, runState: buyProducer(run, save.metaState, config, p.id, 1).run }) })
    }
    for (const u of config.upgrades) {
      if (run.ownedUpgradeIds.includes(u.id)) continue
      const trial = buyUpgrade({ ...run, coreEnergy: Infinity }, config, u.id)
      if (trial.error) continue
      const next = { ...save, runState: { ...run, ownedUpgradeIds: [...run.ownedUpgradeIds, u.id] } }
      options.push({ cost: scaledCost(run, u.cost), score: consider(scaledCost(run, u.cost), next), apply: () => ({ ...save, runState: buyUpgrade(run, config, u.id).run }) })
    }
    for (const n of config.skillNodes) {
      if (run.ownedSkillNodeIds.includes(n.id) || !isSkillNodeVisible(run, n)) continue
      if (n.branch === "TRANSCENDENCE" && !canRebirth(run, save.metaState, config)) continue
      const next = { ...save, runState: { ...run, ownedSkillNodeIds: [...run.ownedSkillNodeIds, n.id] } }
      // Nodes that open a path are worth a little extra: they reveal what lies behind.
      const opens = config.skillNodes.some((c) => c.requires?.includes(n.id))
      const score = consider(scaledCost(run, n.cost), next) * (opens ? 0.6 : 1)
      options.push({ cost: scaledCost(run, n.cost), score, apply: () => ({ ...save, runState: buySkillNode(run, config, n.id).run }) })
    }
    options.sort((a, b) => a.score - b.score || a.cost - b.cost)
    const pick = options.find((o) => o.score < 3600)
    if (!pick || pick.cost > run.coreEnergy) return
    save = pick.apply()
  }
}

function step(dt: number): void {
  const beforeTick = save.runState.lifetimeCoreEnergy
  const prodNow = productionSnapshot(save.runState, save.metaState, config, now).perSecond
  now += dt * 1000
  const t = processTick(save.runState, save.metaState, config, now)
  const tickGain = t.run.lifetimeCoreEnergy - beforeTick
  sources.production = (sources.production ?? 0) + Math.min(tickGain, prodNow * dt)
  sources.tickExtra = (sources.tickExtra ?? 0) + Math.max(0, tickGain - prodNow * dt)
  if (process.env.TRACE && t.run.lifetimeCoreEnergy > save.runState.lifetimeCoreEnergy * 3 && t.run.lifetimeCoreEnergy > 1e6)
    console.log(`  TICK jump ${save.runState.lifetimeCoreEnergy.toExponential(2)} → ${t.run.lifetimeCoreEnergy.toExponential(2)} fever=${t.run.fever.phase} boosts=${JSON.stringify(t.run.eventBoosts.map((b) => b.id + b.multiplier))} inst=${t.run.instability}`)
  save = { ...save, runState: t.run, metaState: t.meta }
  // Mirrors the application's auto-start of a full FEVER gauge.
  if (save.runState.fever.phase === "IDLE" && save.runState.fever.gauge >= config.feverGaugeMax) {
    const f = startFever(save.runState, save.metaState, config, "GAUGE", null)
    if (!f.error) save = { ...save, runState: f.run }
  }
}

const runLog: string[] = []
const sources: Record<string, number> = {}
const credit = (key: string, before: number) => {
  sources[key] = (sources[key] ?? 0) + (save.runState.lifetimeCoreEnergy - before)
}
/** Share of targets a decent player hits in a region field challenge. */
const CHALLENGE_SCORE = 0.8
/** Scripted hunter speed; NO_HUNT=1 skips hunts to compare against the pre-hunt pacing. */
const HUNTER_TAPS = knob("HUNTER_TAPS", 5)
let runStart = 0
let milestone = 3
let mineCycles = 0

function bestRegion(): void {
  const run = save.runState
  const ready = config.regions.filter((r) => isRegionUnlocked(run, config, r.id) && r.activity && regionActivityReady(run, r.id, now))
  for (const region of ready) {
    if (run.currentRegionId !== region.id) {
      const moved = travelToRegion(save.runState, config, region.id)
      if (!moved.error) save = { ...save, runState: moved.run }
    }
    const before = save.runState.lifetimeCoreEnergy
    const used = activateRegion(save.runState, save.metaState, config, region.id, now)
    if (!used.error) sources[`act:${region.id}`] = (sources[`act:${region.id}`] ?? 0) + used.run.lifetimeCoreEnergy - before
    if (process.env.TRACE && !used.error) console.log(`  activity ${region.id} +${(used.run.lifetimeCoreEnergy - before).toExponential(2)}`)
    if (!used.error) save = { ...save, runState: used.run, metaState: used.meta }
  }
  // Field challenges: played at CHALLENGE_SCORE, costing the countdown plus play time.
  for (const region of config.regions) {
    if (!region.challenge || !isRegionUnlocked(save.runState, config, region.id)) continue
    if (save.runState.currentRegionId !== region.id) {
      const moved = travelToRegion(save.runState, config, region.id)
      if (moved.error) continue
      save = { ...save, runState: moved.run }
    }
    if (regionChallengeError(save.runState, config, region.id, now)) continue
    for (let sec = 0; sec < region.challenge.durationSec + 3; sec++) step(1)
    const before = save.runState.lifetimeCoreEnergy
    const played = claimRegionChallenge(save.runState, save.metaState, config, region.id, CHALLENGE_SCORE, now)
    if (played.error) continue
    save = { ...save, runState: played.run, metaState: played.meta }
    sources[`challenge:${region.id}`] = (sources[`challenge:${region.id}`] ?? 0) + save.runState.lifetimeCoreEnergy - before
    shop()
  }
  // Monster hunts: played out by the scripted hunter; the fight clock runs the ticks.
  for (const region of process.env.NO_HUNT ? [] : config.regions) {
    if (!region.hunt || !isRegionUnlocked(save.runState, config, region.id)) continue
    if (save.runState.currentRegionId !== region.id) {
      const moved = travelToRegion(save.runState, config, region.id)
      if (moved.error) continue
      save = { ...save, runState: moved.run }
    }
    if (regionHuntError(save.runState, config, region.id, now)) continue
    const played = autoplayHunt(
      region.hunt,
      config.monsters,
      {
        power: huntPower(save.metaState.rebirthCount),
        critChance: huntCritChance(derivedClick(save.runState, save.metaState, config).critChance),
        tapsPerSec: HUNTER_TAPS,
        accuracy: 0.85,
        reactionMs: 600,
      },
      rng,
    )
    const summary = summarizeHunt(played)
    for (let sec = 0; sec < Math.ceil(played.endedAt / 1000) + 3; sec++) step(1)
    const before = save.runState.lifetimeCoreEnergy
    const claimed = claimRegionHunt(save.runState, save.metaState, config, region.id, {
      score: summary.score,
      kills: summary.kills,
      bossDown: summary.bossDown,
      flawless: summary.flawless,
      cleared: summary.outcome === "won",
    }, now)
    if (claimed.error) continue
    save = { ...save, runState: claimed.run, metaState: claimed.meta }
    sources[`hunt:${region.id}`] = (sources[`hunt:${region.id}`] ?? 0) + save.runState.lifetimeCoreEnergy - before
    // A hunt takes a while; a real player spends the payout before heading to the next one.
    shop()
  }
  // The mine only exists at home: walk back before the next session.
  if (save.runState.currentRegionId !== homeRegionId(config)) {
    save = { ...save, runState: returnHomeRegion(save.runState, config).run }
  }
}

while (elapsed() < MAX_HOURS * 3600) {
  bestRegion()
  const entered = enterClickerMine(save, now, config)
  if (!entered.error) {
    save = entered.save
    mineCycles++
    const vein = rng() < VEIN_SPAWN_CHANCE ? 2 + Math.floor(rng() * 6) : -1
    let sec = 0
    while (save.runState.mineSessionEndsAt > now) {
      const strikes = CLICKS_PER_SEC + autoDrillRate(save.runState, config, now)
      for (let i = 0; i < strikes; i++) {
        const before = save.runState.lifetimeCoreEnergy
        const c = processClick(save.runState, save.metaState, config, now + i, rng)
        save = { ...save, runState: c.run, metaState: c.meta }
        credit("click", before)
      }
      if (sec === vein) {
        const per = productionSnapshot(save.runState, save.metaState, config, now).perSecond
        const beforeVein = save.runState.lifetimeCoreEnergy
        const v = claimGoldenVein(save.runState, save.metaState, per, now, rng)
        if (process.env.TRACE) console.log(`  vein ${v.outcome.kind} +${(v.run.lifetimeCoreEnergy - save.runState.lifetimeCoreEnergy).toExponential(2)}`)
        save = { ...save, runState: v.run, metaState: v.meta }
        credit("vein", beforeVein)
      }
      step(1)
      sec++
      save = syncClickerMineSession(save, now)
    }
    save = syncClickerMineSession(save, now)
    save = { ...save, metaState: { ...save.metaState, statistics: { ...save.metaState.statistics, mineSessions: save.metaState.statistics.mineSessions + 1 } } }
  } else {
    step(1)
  }
  save = { ...save, metaState: awardAchievements(save.runState, save.metaState, config.achievements).meta }
  shop()
  if (process.env.MILESTONES && save.metaState.rebirthCount === 0) {
    const life = save.runState.lifetimeCoreEnergy
    while (life >= 10 ** milestone) {
      console.log(`  WL1 1e${milestone} at ${fmt(elapsed())} · prod/s ${productionSnapshot(save.runState, save.metaState, config, now).perSecond.toExponential(1)} · lv ${Object.values(save.runState.producerLevels).reduce((a, b) => a + b, 0)}`)
      milestone++
    }
  }

  if (process.env.TRACE && (process.env.TRACE === "all" || Math.floor(elapsed()) % 60 < 12)) {
    const r = save.runState
    const d = derivedClick(r, save.metaState, config)
    console.log(
      `t=${fmt(elapsed())} wl=${save.metaState.rebirthCount + 1} life=${r.lifetimeCoreEnergy.toExponential(2)} bank=${r.coreEnergy.toExponential(2)} prod/s=${productionSnapshot(r, save.metaState, config, now).perSecond.toExponential(2)} click=${d.click.toExponential(2)} crit=${d.critMult.toFixed(1)} drone/s=${droneEnergyPerSecond(r, save.metaState, config, now).toExponential(2)} fever=${r.fever.phase} lv=${Object.values(r.producerLevels).reduce((a, b) => a + b, 0)} skills=${r.ownedSkillNodeIds.length}`,
    )
  }
  if (canRebirth(save.runState, save.metaState, config)) {
    const buff = config.transcendence.find((b) => !save.metaState.transcendenceIds.includes(b.id)) ?? config.transcendence[0]
    const need = rebirthRequirement(save.metaState, config)
    const skills = save.runState.ownedSkillNodeIds.length
    const r = applyRebirth(save.runState, save.metaState, config, buff.id, now)
    if (process.env.SOURCES) {
      const total = Object.values(sources).reduce((a, b) => a + b, 0)
      runLog.push("   " + Object.entries(sources).map(([k, v]) => `${k} ${((v / total) * 100).toFixed(0)}%`).join(" · "))
      for (const k of Object.keys(sources)) delete sources[k]
    }
    if (process.env.LEVELS) runLog.push("   levels " + Object.entries(save.runState.producerLevels).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(" ") + " · regions " + config.regions.filter((r) => isRegionUnlocked(save.runState, config, r.id)).length)
    runLog.push(
      `worldline ${save.metaState.rebirthCount + 1}: ${fmt(elapsed() - runStart)} (goal ${need.toExponential(0)}, skills ${skills}/${config.skillNodes.length}) → ${buff.id}`,
    )
    save = { ...save, runState: r.run, metaState: r.meta }
    runStart = elapsed()
    if (canTriggerTrueEnding(save.metaState, config)) break
  }
}

console.log(`clicks/s ${CLICKS_PER_SEC} · mine sessions ${mineCycles}`)
for (const line of runLog) console.log(line)
console.log(`total ${fmt(elapsed())}${canTriggerTrueEnding(save.metaState, config) ? " · true ending" : " · NOT FINISHED"}`)
