import type { WorldlineRuleDef } from "../../domain/entities/clicker.ts"

/*
 * One rule per worldline 2-8 (worldline 1, the first playthrough, has none). Each "+" is paid by a "−" of the same size (pair product ≈ 1), so
 * the 8-hour pace holds: scripts/playtime-sim.ts total stays within ±0.5 % of 472m50s
 * (guarded by scripts/worldline-rules-sim.test.mjs).
 */
export const CLICKER_WORLDLINE_RULES: readonly WorldlineRuleDef[] = [
  { id: "rule_overheat", worldline: 2, name: "과열", icon: "worldline_rule_icon_02", plus: "+ FEVER 지속 +30%", minus: "− FEVER 재충전 +30%", effects: { feverDurationMultiplier: 1.3, feverCooldownMultiplier: 1.3 } },
  { id: "rule_abyss", worldline: 3, name: "심연", icon: "worldline_rule_icon_03", plus: "+ 사냥·보스 보상 +25%", minus: "− 수호자 체력 +25%", effects: { bossRewardMultiplier: 1.25, bossHpMultiplier: 1.25 } },
  { id: "rule_calm", worldline: 4, name: "고요", icon: "worldline_rule_icon_04", plus: "+ 자동 생산 +20%", minus: "− 채굴 −25%", effects: { productionMultiplier: 1.2, clickMultiplier: 0.75 } },
  { id: "rule_chain", worldline: 5, name: "연쇄", icon: "worldline_rule_icon_05", plus: "+ 콤보 한도 +40%", minus: "− 콤보 유지 시간 −29%", effects: { comboMaxMultiplier: 1.4, comboWindowMultiplier: 1 / 1.4 } },
  { id: "rule_resonance", worldline: 6, name: "공명", icon: "worldline_rule_icon_06", plus: "+ 스킬 효과 +25%", minus: "− 스킬 가격 +25%", effects: { skillEffectMultiplier: 1.25, skillCostMultiplier: 1.25 } },
  { id: "rule_plenty", worldline: 7, name: "풍요", icon: "worldline_rule_icon_07", plus: "+ 지역 화폐 +50%", minus: "− CORE −3%", effects: { regionCurrencyMultiplier: 1.5, coreMultiplier: 0.97 } },
  { id: "rule_haste", worldline: 8, name: "가속", icon: "worldline_rule_icon_08", plus: "+ 시간 흐름 +25%", minus: "− 초당 생산 −10%", effects: { timeScale: 1.25, productionMultiplier: 0.9 } },
]
