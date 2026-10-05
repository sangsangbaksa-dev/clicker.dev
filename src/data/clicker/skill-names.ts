import type { SkillNodeDef } from "../../domain/entities/clicker"

/** Display names for every skill circuit (ids stay the save/asset keys). */
export const SKILL_NAMES: Record<string, string> = {
  // FOCUS — the strike itself
  focus_grip: "Iron Knuckle",
  focus_click: "Pulse Needle",
  focus_press: "Seam Crusher",
  focus_tempo: "Momentum Gauntlet",
  focus_combo: "Afterimage Strike",
  focus_sharp: "Hairline Sight",
  focus_crit: "Fracture Map",
  focus_edge: "Knife's Grain",
  focus_heavy: "Anvil Palm",
  focus_amp: "Resonant Fist",
  focus_split: "Prism Split",
  focus_pinpoint: "Needle's Eye",
  focus_deep: "Marrow Bite",
  focus_lethal: "Deathknell Tone",
  focus_chain: "Echo Ledger",
  focus_rhythm: "Seismic Cadence",
  focus_titan: "Titan's Forearm",
  focus_overcharge: "Redline Trigger",
  focus_breaker: "Core Sunderer",
  focus_star: "Starfall Hammer",
  focus_apex: "One True Strike",
  mine_quick: "Spark Pick",
  mine_lamp: "Lantern Eye",
  mine_turn: "Quick Cage Lift",
  mine_dwell: "Stubborn Lamp",
  mine_extend: "Vein Biter",
  mine_deepcut: "Lower Gallery",
  mine_marathon: "Fault Reader",
  mine_endless: "Bottomless Shift",
  mine_eternal: "Heartvein Strike",
  storm_spark: "Skycaller",
  storm_static: "Crackling Hair",
  storm_bolt: "Stormbait",
  storm_charge: "Capacitor Bones",
  storm_arc: "Blue Arc",
  storm_rod: "Lightning Spine",
  storm_chain: "Forked Tongue",
  storm_thunder: "Thunderhead Crown",
  storm_apex: "Tempest Throne",
  quake_tremor: "Ground Knock",
  quake_step: "Stomping Boots",
  quake_pulse: "Seismic Drum",
  quake_force: "Tectonic Push",
  quake_fault: "Hairline Fault",
  quake_rupture: "Crust Breaker",
  quake_apex: "Worldsplitter",
  echo_tap: "Afterimage",
  echo_ring: "Bell in the Rock",
  echo_double: "Twin Shadow",
  echo_resonant: "Mirror Vein",
  echo_apex: "Hall of Echoes",
  // AUTOMATION — the machines
  auto_prod: "Humming Grid",
  auto_oil: "Black Oil Line",
  auto_loop: "Closed Loop",
  auto_belt: "Endless Belt",
  auto_more: "Stacked Floors",
  auto_gear: "Planetary Gears",
  auto_surge: "Surge Rail",
  auto_cool: "Cryo Coolant",
  auto_drill: "Assist Drill",
  auto_press: "Tonnage Press",
  auto_mesh: "Spider Mesh",
  auto_early: "Old Reliables",
  auto_link: "Relay Choir",
  auto_core: "Extractor Pact",
  auto_drill2: "Twin Bit",
  auto_robot: "Six-Axis Arm",
  auto_factory: "Lights-Out Factory",
  auto_control: "Phase Governor",
  auto_mid: "Middle Kingdom",
  auto_burst: "Foundry Heartbeat",
  auto_drill3: "Drill Locust",
  auto_ai: "Foreman Mind",
  auto_overflow: "Overflow Cascade",
  auto_risk: "Gambler's Harness",
  auto_late: "Horizon Scaffold",
  auto_grid2: "Deep Lattice",
  auto_end: "Event Horizon",
  auto_end2: "Nova Siphon",
  auto_mega: "Dyson Ribcage",
  auto_apex: "Perpetual Engine",
  drone_scout: "Firefly Scout",
  drone_pair: "Wingmate",
  drone_bay: "Hive Hatch",
  drone_tune: "Servo Whisper",
  drone_squad: "Hornet Squad",
  drone_ai: "Swarm Instinct",
  drone_mesh: "Murmuration",
  drone_fleet: "Iron Locusts",
  drone_apex: "Queen of the Hive",
  // RESONANCE — FEVER and resonance
  reso_fever: "Fever Echo",
  reso_hum: "Low Drone",
  reso_glow: "Ember Glow",
  reso_linger: "Lingering Heat",
  reso_intense: "Overdrive Tone",
  reso_spark: "Spark Cascade",
  reso_hymn: "Miner's Hymn",
  reso_tempo: "Rubato",
  reso_chorus: "Cavern Chorus",
  reso_choir: "Choir of Pipes",
  reso_bell: "Bronze Bell",
  reso_encore: "Encore",
  reso_finale: "Grand Finale",
  reso_edge: "Resonant Hum",
  reso_risk: "Harmonic Dance",
  reso_brink: "Crescendo Engine",
  reso_abyss: "Deep Chord",
  reso_static: "Static Psalm",
  reso_wave: "Standing Wave",
  reso_wave2: "Crest Harmonic",
  reso_overture: "Overture",
  reso_amplify: "Harmonic Amplifier",
  reso_array: "Echo Weave",
  reso_array2: "Harmonic Grid",
  reso_peak: "Perfect Pitch",
  reso_storm: "Resonance Storm",
  reso_crown: "Harmonic Crown",
  reso_apex: "Endless Fever",
  // TRANSCENDENCE — what survives a fold
  trans_start: "Memory Seed",
  trans_spark: "Ember of Before",
  trans_kin: "Kindred Hands",
  trans_flow: "Worldflow",
  trans_seed2: "Memory Orchard",
  trans_mine: "Old Engines",
  trans_deep: "Déjà Vu",
  trans_echo: "Worldline Echo",
  trans_insight: "Swarm Memory",
  trans_focus: "Worldline Strike",
  trans_grid: "Worldline Grid",
  trans_fever: "Timeless Fever",
  trans_vault: "Memory Vault",
  trans_storm: "Eternal Storm",
  trans_quake: "Tectonic Memory",
  trans_drone: "Ghost Drones",
  trans_crit: "Fatal Memory",
  trans_echo_hit: "Echo of Worlds",
  trans_seed3: "Genesis Seed",
  trans_convergence: "Convergence",
  trans_heart: "Heart Key",
  // HUNT — creatures and wardens
  hunt_start: "Hunter's Mark",
  hunt_track: "Scent of Ore",
  hunt_blade: "Serrated Edge",
  hunt_bait: "Glowstone Bait",
  hunt_trophy: "Trophy Wall",
  hunt_pack: "Pack Tactics",
  hunt_lure: "Siren Lure",
  hunt_pelt: "Crystal Pelts",
  hunt_slayer: "Beastbreaker",
  hunt_bane: "Warden's Bane",
  hunt_apex: "Apex Predator",
}

const pct = (v: number) => `${+(v * 100).toFixed(1)}%`
const times = (v: number) => `×${+v.toFixed(2)}`

/**
 * One effect line per stat, with a hint of what it does ("확률", "강화" …). Unlock circuits keep
 * their hand-written explanation; tagged production keeps its producer list.
 */
export function describeSkillNode(n: SkillNodeDef): string {
  const parts: string[] = []
  if (n.clickMultiplier) parts.push(`채굴 위력 ${times(n.clickMultiplier)} 강화`)
  if (n.productionMultiplier && !n.producerTag) parts.push(`자동 생산량 ${times(n.productionMultiplier)} 증폭`)
  if (n.criticalChanceAdd) parts.push(`치명타 발생 확률 +${pct(n.criticalChanceAdd)}`)
  if (n.criticalMultiplier) parts.push(`치명타 피해 배율 ${times(n.criticalMultiplier)}`)
  if (n.comboWindowAdd) parts.push(`콤보 유지 시간 +${n.comboWindowAdd}초 연장`)
  if (n.comboMaxAdd) parts.push(`콤보 최대 단계 +${n.comboMaxAdd}`)
  if (n.mineSessionSecondsAdd) parts.push(`광산 채굴 시간 +${n.mineSessionSecondsAdd}초 연장`)
  if (n.cooldownReduceSec)
    parts.push(
      n.monsterRespawnReduce
        ? `광산·시추 대기와 크리처 재등장 -${n.cooldownReduceSec}초 단축`
        : `광산·시추 재입장 대기 -${n.cooldownReduceSec}초 단축`,
    )
  else if (n.monsterRespawnReduce) parts.push(`크리처 재등장 대기 -${n.monsterRespawnReduce}초 단축`)
  if (n.autoDrillPerSecond) parts.push(`보조 드릴 +${n.autoDrillPerSecond}회/초 (커서 위치 자동 채굴)`)
  if (n.lightningChanceAdd) parts.push(`타격 시 번개 낙뢰 확률 +${pct(n.lightningChanceAdd)}`)
  if (n.lightningMultiplierAdd) parts.push(`번개 피해 배율 +${n.lightningMultiplierAdd} 강화`)
  if (n.lightningChainAdd) parts.push(`번개 연쇄 +${n.lightningChainAdd}회 (연쇄마다 번개 피해의 50%)`)
  if (n.quakeMultiplierAdd) parts.push(`지진파 피해 배율 +${n.quakeMultiplierAdd} 강화`)
  if (n.quakeIntervalReduce) parts.push(`지진파 발동 주기 ${n.quakeIntervalReduce}타 단축`)
  if (n.echoChanceAdd) parts.push(`잔향 재타격 확률 +${pct(n.echoChanceAdd)}`)
  if (n.droneStrikesPerSecond) parts.push(`채굴 드론 타격 +${n.droneStrikesPerSecond}회/초`)
  if (n.droneEfficiencyAdd) parts.push(`드론 타격 효율 +${pct(n.droneEfficiencyAdd)} 강화`)
  if (n.feverDurationAdd) parts.push(`FEVER 지속 +${n.feverDurationAdd}초 연장`)
  if (n.feverIntensity) parts.push(`FEVER 보상 강도 +${pct(n.feverIntensity - 1)}`)
  if (n.finisherReward) parts.push(`FEVER 피니셔 보상 ${times(n.finisherReward)}`)
  if (n.flatProductionBonus) parts.push(`생산 +${pct(n.flatProductionBonus)}`)
  if (n.monsterRewardMultiplier) parts.push(`크리처 처치 보상 ${times(n.monsterRewardMultiplier)}`)
  if (n.bossDamageMultiplier) parts.push(`수호자에게 주는 피해 ${times(n.bossDamageMultiplier)}`)
  return parts.join(" · ")
}

/** Circuits whose description explains a new mechanic (or lists producers / carried CORE) stay as written. */
function keepsOwnText(n: SkillNodeDef): boolean {
  return /해금/.test(n.description) || Boolean(n.producerTag) || n.startingEnergy !== undefined
}

/** Hand-written lines where the generated one would drop a detail or run too long. */
const DESCRIPTIONS: Record<string, (n: SkillNodeDef) => string> = {
  auto_drill: (n) => `보조 드릴 해금 · 커서 위치를 초당 ${n.autoDrillPerSecond}회 자동 채굴 · 과부하 시 ×3 (30초, 재충전 10분)`,
  trans_heart: (n) => `채굴·생산 ×${n.clickMultiplier} 폭증 · 치명타 피해 ×${n.criticalMultiplier} · 드론 타격 +${n.droneStrikesPerSecond}회/초`,
}

export function nameSkillNode(n: SkillNodeDef): SkillNodeDef {
  const name = SKILL_NAMES[n.id] ?? n.name
  if (DESCRIPTIONS[n.id]) return { ...n, name, description: DESCRIPTIONS[n.id](n) }
  if (keepsOwnText(n)) {
    const description = n.producerTag
      ? n.description.replace(/생산자 ×([\d.]+)/, "생산자 출력 ×$1 증폭")
      : n.startingEnergy !== undefined
        ? n.description.replace(/^다음 런 시작 \+(.+) CORE$/, "초월 후 다음 런을 CORE +$1 들고 시작")
        : n.description
    return { ...n, name, description }
  }
  return { ...n, name, description: describeSkillNode(n) || n.description }
}
