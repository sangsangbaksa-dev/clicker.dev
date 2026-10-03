import type { WorldTreeNodeDef } from "../../domain/entities/clicker"

/**
 * One skill tree per world. Each is bought in order with that world's currency only, and every
 * node affects that world only. Two of the five nodes raise the currency mint, so a world starts
 * out paying a trickle and its own tree turns it into a real income.
 */
type Spec = { name: string; description: string } & Omit<WorldTreeNodeDef, "id" | "regionId" | "name" | "description" | "costShare">

/** Price ladder shared by every world (share of unlock threshold × base mint rate). */
const COST_SHARES = [0.02, 0.06, 0.15, 0.4, 1]

function tree(regionId: string, nodes: Spec[]): WorldTreeNodeDef[] {
  return nodes.map((n, i) => ({ ...n, id: `${regionId}_t${i + 1}`, regionId, costShare: COST_SHARES[i] }))
}

export const CLICKER_WORLD_TREES: WorldTreeNodeDef[] = [
  ...tree("signal_relay", [
    { name: "잡음 필터", description: "이 지역의 코어 에너지 획득 ×3", currencyMultiplier: 3 },
    { name: "중계 공명", description: "Signal Relay에 있는 동안 클릭·생산 ×1.5", presenceMultiplier: 1.5 },
    { name: "증폭 코일", description: "주파수 증폭 효과 ×1.5 · 신호 포착 보상 ×1.5", activityMultiplier: 1.5, challengeMultiplier: 1.5 },
    { name: "광대역 수신", description: "이 지역의 코어 에너지 획득 ×4", currencyMultiplier: 4 },
    { name: "신호 지배", description: "Signal Relay에 있는 동안 클릭·생산 ×2 · 신호 포착 보상 ×2", presenceMultiplier: 2, challengeMultiplier: 2 },
  ]),
  ...tree("phase_vault", [
    { name: "수정 정제", description: "이 지역의 위상 수정 획득 ×3", currencyMultiplier: 3 },
    { name: "위상 공명", description: "Phase Vault에 있는 동안 클릭·생산 ×1.5", presenceMultiplier: 1.5 },
    { name: "이자 증폭", description: "위상 예치 회수액 증가 · 금고 해제 보상 ×1.5", activityMultiplier: 1.5, challengeMultiplier: 1.5 },
    { name: "심층 채굴", description: "이 지역의 위상 수정 획득 ×4", currencyMultiplier: 4 },
    { name: "금고 지배", description: "Phase Vault에 있는 동안 클릭·생산 ×2 · 수정 타이탄 보상 ×2", presenceMultiplier: 2, monsterMultiplier: 2 },
  ]),
  ...tree("storm_spire", [
    { name: "전하 포집", description: "이 지역의 뇌운 전하 획득 ×3", currencyMultiplier: 3 },
    { name: "뇌운 공명", description: "Storm Spire에 있는 동안 클릭·생산 ×1.5", presenceMultiplier: 1.5 },
    { name: "낙뢰 연장", description: "낙뢰 소환 시간 ×1.5 · 피뢰침 포획 보상 ×1.5", activityMultiplier: 1.5, challengeMultiplier: 1.5 },
    { name: "폭풍 수확", description: "이 지역의 뇌운 전하 획득 ×4", currencyMultiplier: 4 },
    { name: "번개 지배", description: "Storm Spire에 있는 동안 클릭·생산 ×2 · 뇌운 드래곤 보상 ×2", presenceMultiplier: 2, monsterMultiplier: 2 },
  ]),
  ...tree("deep_fault", [
    { name: "용암 정련", description: "이 지역의 용암석 획득 ×3", currencyMultiplier: 3 },
    { name: "단층 공명", description: "Deep Fault에 있는 동안 클릭·생산 ×1.5", presenceMultiplier: 1.5 },
    { name: "지각 증폭", description: "지각 붕괴 획득량 ×1.5 · 단층 시추 보상 ×1.5", activityMultiplier: 1.5, challengeMultiplier: 1.5 },
    { name: "마그마 수확", description: "이 지역의 용암석 획득 ×4", currencyMultiplier: 4 },
    { name: "단층 지배", description: "Deep Fault에 있는 동안 클릭·생산 ×2 · 용암 베히모스 보상 ×2", presenceMultiplier: 2, monsterMultiplier: 2 },
  ]),
  ...tree("core_heart", [
    { name: "파편 수집", description: "이 지역의 심장 파편 획득 ×3", currencyMultiplier: 3 },
    { name: "심장 공명", description: "Core Heart에 있는 동안 클릭·생산 ×1.5", presenceMultiplier: 1.5 },
    { name: "맥동 동조", description: "Core Heart에 있는 동안 클릭·생산 ×1.3", presenceMultiplier: 1.3 },
    { name: "심장 수확", description: "이 지역의 심장 파편 획득 ×4", currencyMultiplier: 4 },
    { name: "심장 지배", description: "Core Heart에 있는 동안 클릭·생산 ×2", presenceMultiplier: 2 },
  ]),
]

/** A world starts by minting this share of the CORE earned there as its currency. */
export const REGION_CURRENCY_RATE = 0.02
