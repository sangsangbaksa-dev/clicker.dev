export type IntroStep = {
  id: string
  title: string
  body: string
  /** Full-bleed stage background for cinematic intro. */
  bgAssetId: string
}

export type TutorialStep = {
  id: string
  title: string
  body: string
  /** CSS anchor hint for spotlight copy (not a DOM selector requirement). */
  focus: "core" | "actions" | "drawer" | "goal" | "done"
}

/**
 * First-run cinematic — 12 beats, text + background only.
 * Backgrounds cycle existing public/clicker/bg plates (no new art required).
 */
export const CLICKER_INTRO_STEPS: IntroStep[] = [
  {
    id: "blackout",
    title: "이름 없는 각성",
    bgAssetId: "/clicker/bg/loading_core_awakening.png",
    body: "빛이 꺼진 곳에서 당신은 숨을 고릅니다. 누가 당신을 여기 두었는지, 기억은 아직 닫혀 있습니다.",
  },
  {
    id: "pulse",
    title: "먼 맥동",
    bgAssetId: "/clicker/bg/loading_core_awakening.png",
    body: "어둠 너머에서 낮은 진동이 다가옵니다. 심장이 아니라, 기계의 심장처럼 규칙적인 울림입니다.",
  },
  {
    id: "threshold",
    title: "문의 가장자리",
    bgAssetId: "/clicker/bg/region_core_chamber.png",
    body: "발밑이 금속으로 바뀝니다. 공기가 차갑고, 벽에 새겨진 회로가 희미하게 숨을 쉽니다.",
  },
  {
    id: "chamber",
    title: "AURELIA CORE Chamber",
    bgAssetId: "/clicker/bg/region_core_chamber.png",
    body: "중앙에 작은 핵이 떠 있습니다. 세계선이 시작되는 방 — CORE는 약하지만, 죽지는 않았습니다.",
  },
  {
    id: "luma-whisper",
    title: "LUMA의 잔향",
    bgAssetId: "/clicker/bg/region_core_chamber.png",
    body: "홀로그램처럼 얇은 목소리가 귓가에 맺힙니다. “나를 기억하지 않아도 돼. 다만… 깨워 줘.”",
  },
  {
    id: "relay-enter",
    title: "중계 복도로",
    bgAssetId: "/clicker/bg/region_signal_relay.png",
    body: "벽면의 케이블이 신호를 삼킵니다. 이곳은 Signal Relay — 코어의 숨이 바깥으로 흘러가는 통로입니다.",
  },
  {
    id: "relay-signal",
    title: "흘러가는 잔향",
    bgAssetId: "/clicker/bg/region_signal_relay.png",
    body: "패널이 파랗게 점멸합니다. 누군가의 기록이 파편처럼 스쳐 지나갑니다. 이름들은 모두 지워져 있습니다.",
  },
  {
    id: "vault-gate",
    title: "보관소의 문",
    bgAssetId: "/clicker/bg/region_phase_vault.png",
    body: "더 깊은 곳으로 내려갑니다. Phase Vault — 공명의 먼지가 쌓인 침묵의 창고입니다.",
  },
  {
    id: "vault-echo",
    title: "잠든 세계선들",
    bgAssetId: "/clicker/bg/region_phase_vault.png",
    body: "선반마다 다른 가능성이 잠들어 있습니다. 언젠가 당신은 이 중 하나를 다시 열게 될지도 모릅니다.",
  },
  {
    id: "fold",
    title: "접힌 방",
    bgAssetId: "/clicker/bg/transcendence_room_base.png",
    body: "공간이 접히고, 보라빛 기둥이 일어섭니다. 초월의 문턱 — 아직은 들어갈 수 없습니다.",
  },
  {
    id: "promise",
    title: "약속 하나",
    bgAssetId: "/clicker/bg/transcendence_room_base.png",
    body: "충분히 길어지면, 세계선을 접고 다른 규칙으로 다시 시작할 수 있습니다. 지금은 살아남는 일부터입니다.",
  },
  {
    id: "return",
    title: "첫 손길",
    bgAssetId: "/clicker/bg/region_core_chamber.png",
    body: "다시 Chamber. 광맥이 당신을 기다립니다. 손을 뻗어 채굴하면, AURELIA가 다시 숨을 쉴 것입니다.",
  },
]

/** Post-story UI tutorial — shown once over the live game shell. */
export const CLICKER_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "core",
    title: "광맥 채굴",
    focus: "core",
    body: "중앙 광맥을 누르거나 길게 유지하면 CORE가 찹니다. 연타와 홀드로 콤보·FEVER 게이지를 쌓으세요.",
  },
  {
    id: "actions",
    title: "물약 · 스킬 바",
    focus: "actions",
    body: "하단 아이콘은 보유 물약과 일회용 스킬입니다. SHOP에서 산 뒤 여기서 사용하세요.",
  },
  {
    id: "drawer",
    title: "하단 패널",
    focus: "drawer",
    body: "생산·강화·스킬·상점·지역 탭이 여기에 있습니다. 손잡이를 위로 끌어 넓힐 수 있습니다.",
  },
  {
    id: "goal",
    title: "LUMA 목표",
    focus: "goal",
    body: "오른쪽 목표 패널의 LUMA 메시지를 따라가면 다음 할 일이 안내됩니다.",
  },
  {
    id: "done",
    title: "준비 완료",
    focus: "done",
    body: "튜토리얼은 여기까지입니다. 광맥을 깨우고, 방을 되찾으세요.",
  },
]

export const REBIRTH_CHAMBER_REMINDER =
  "AURELIA CORE Chamber. 광맥을 누르거나 길게 채굴해 에너지를 되살리세요. 이번 세계선의 규칙이 새로 씌워집니다."
