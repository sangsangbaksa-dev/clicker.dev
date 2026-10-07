import type { AchievementDef } from "../../domain/entities/clicker"

/** Late-game milestones: guardian, ending, worldlines, relics, gacha, dawn-mine depth. */
export const LATE_GAME_ACHIEVEMENTS: AchievementDef[] = [
  { id: "boss_guardian", name: "수호자 격파", description: "광산 깊은 곳의 코어 수호자를 쓰러뜨리세요.", kind: "BOSS", target: 1, grantsProductionBonus: false },
  { id: "ending_true", name: "새벽을 본 자", description: "모든 세계선을 지나 진엔딩에 도달하세요.", kind: "ENDING", target: 1, grantsProductionBonus: false },
  { id: "trans_4", name: "세계선 순례자", description: "서로 다른 초월을 4종 얻으세요.", kind: "TRANSCENDENCE", target: 4, grantsProductionBonus: false },
  { id: "trans_8", name: "여덟 세계선을 걷다", description: "서로 다른 초월 8종을 모두 얻으세요.", kind: "TRANSCENDENCE", target: 8, grantsProductionBonus: false },
  { id: "relic_1", name: "유물 첫 강화", description: "유물 보관소에서 유물을 처음으로 강화하세요.", kind: "RELIC_LEVELS", target: 1, grantsProductionBonus: false },
  { id: "relic_10", name: "유물 수집가", description: "모든 유물의 레벨 합계를 10까지 올리세요.", kind: "RELIC_LEVELS", target: 10, grantsProductionBonus: false },
  { id: "gacha_50", name: "캡슐 애호가", description: "코어 캡슐을 50번 여세요.", kind: "GACHA_PULLS", target: 50, grantsProductionBonus: false },
  { id: "gacha_leg_1", name: "전설을 뽑다", description: "코어 캡슐에서 전설 등급을 1번 뽑으세요.", kind: "GACHA_LEGENDARY", target: 1, grantsProductionBonus: false },
  { id: "gacha_leg_5", name: "전설 수집가", description: "코어 캡슐에서 전설 등급을 5번 뽑으세요.", kind: "GACHA_LEGENDARY", target: 5, grantsProductionBonus: false },
  { id: "dawn_1", name: "새벽의 첫 갱도", description: "엔딩 후 새벽의 광산에서 깊이 1에 도달하세요.", kind: "POSTGAME_DEPTH", target: 1, grantsProductionBonus: false },
  { id: "dawn_10", name: "깊어지는 새벽", description: "새벽의 광산에서 깊이 10까지 내려가세요.", kind: "POSTGAME_DEPTH", target: 10, grantsProductionBonus: false },
  { id: "dawn_25", name: "끝없는 새벽", description: "새벽의 광산에서 깊이 25까지 내려가세요.", kind: "POSTGAME_DEPTH", target: 25, grantsProductionBonus: false },
]
