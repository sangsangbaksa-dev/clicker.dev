import type { MonsterDef } from "../../domain/entities/clicker"

/**
 * Hunt bestiary — four monsters per region: swarmer, caster, brute and the region boss.
 * HP is in hunter strikes at power 1 (power grows +20% per walked worldline).
 */
export const CLICKER_MONSTERS: MonsterDef[] = [
  // Signal Relay — echoes of the relay corridors.
  { id: "relay_mite", name: "잔향 진드기", archetype: "SWARMER", hp: 3, lore: "중계 신호를 갉아먹는 작은 잔향체. 맞으면 튀어 달아납니다." },
  { id: "static_wisp", name: "노이즈 위습", archetype: "CASTER", hp: 7, lore: "잡음을 모아 방전합니다. 충전 중 세 번 맞히면 흩어집니다." },
  { id: "relay_golem", name: "중계 골렘", archetype: "BRUTE", hp: 18, lore: "버려진 안테나가 뭉친 거체. 가슴의 코어가 열릴 때 노리세요." },
  { id: "relay_warden", name: "공명 파수꾼", archetype: "BOSS", hp: 62, lore: "중계 복도의 주인. 체력이 줄면 진드기 떼를 부릅니다." },

  // Phase Vault — dust and resonance that never settled.
  { id: "phase_moth", name: "위상 나방", archetype: "SWARMER", hp: 4, lore: "위상 먼지를 뿌리며 흩날립니다." },
  { id: "dust_wraith", name: "먼지 망령", archetype: "CASTER", hp: 8, lore: "보관소의 잔향이 형체를 얻었습니다. 충전을 끊으세요." },
  { id: "vault_keeper", name: "금고 수호체", archetype: "BRUTE", hp: 22, lore: "예치된 CORE를 지키는 장갑체. 약점이 규칙적으로 드러납니다." },
  { id: "phase_matriarch", name: "위상 모체", archetype: "BOSS", hp: 78, lore: "보관소 깊은 곳의 모체. 나방 떼를 낳습니다." },

  // Storm Spire — charged things that live in lightning.
  { id: "spark_imp", name: "스파크 임프", archetype: "SWARMER", hp: 4, lore: "번개 사이를 뛰어다니는 작은 전하." },
  { id: "storm_eye", name: "폭풍의 눈", archetype: "CASTER", hp: 9, lore: "낙뢰를 겨눕니다. 조준 고리가 닫히기 전에 끊으세요." },
  { id: "thunder_giant", name: "뇌운 거인", archetype: "BRUTE", hp: 26, lore: "구름을 두른 거인. 내려찍기 전에 막아야 합니다." },
  { id: "storm_lord", name: "천둥 군주", archetype: "BOSS", hp: 94, lore: "첨탑 꼭대기의 군주. 분노하면 공격이 빨라집니다." },

  // Deep Fault — magma and stone.
  { id: "rock_tick", name: "암석 진드기", archetype: "SWARMER", hp: 5, lore: "단층 틈에서 쏟아지는 돌 벌레." },
  { id: "magma_spitter", name: "마그마 분사체", archetype: "CASTER", hp: 10, lore: "용암을 머금었다가 뱉습니다." },
  { id: "crust_behemoth", name: "지각 거수", archetype: "BRUTE", hp: 30, lore: "지각판을 등에 진 거수. 균열이 빛날 때가 약점입니다." },
  { id: "fault_devourer", name: "단층 포식자", archetype: "BOSS", hp: 112, lore: "행성의 상처를 먹고 자란 포식자." },

  // Drone Foundry — rogue machines.
  { id: "rogue_drone", name: "폭주 드론", archetype: "SWARMER", hp: 5, lore: "명령을 잃은 채굴 드론." },
  { id: "laser_turret", name: "레이저 포탑", archetype: "CASTER", hp: 11, lore: "조준 후 발사합니다. 충전 중 포신을 두드리세요." },
  { id: "assembler", name: "조립 기계", archetype: "BRUTE", hp: 34, lore: "고철로 스스로를 증축하는 기계." },
  { id: "foundry_core", name: "파운드리 코어", archetype: "BOSS", hp: 132, lore: "공장 전체를 움직이는 폭주 코어." },
]
