export type TutorialStep = {
  id: string
  title: string
  body: string
  /** Story beats show a full-bleed plate; UI tips sit over the live game. */
  bgAssetId?: string
}

/** First run: a short story, then how to play. Shown again after a save reset. */
export const CLICKER_TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "dawn",
    title: "빛의 세계, AURELIA",
    bgAssetId: "/clicker/bg/login_core_sanctum.webp",
    body: "아주 오래전, 이 세계의 모든 빛은 땅속 깊은 곳의 AURELIA 코어에서 흘러나왔습니다. 코어가 한 번 맥동할 때마다 광맥이 빛나고, 그 빛을 따라 도시와 탑과 길이 세워졌습니다.",
  },
  {
    id: "silence",
    title: "멈춘 맥동",
    bgAssetId: "/clicker/region/core_heart_still.webp",
    body: "어느 날, 코어의 심장부에서 거대한 그림자가 깨어났습니다. 수호자라 불리던 그것은 코어를 지키는 대신 몸으로 틀어막았고, 맥동은 점점 약해졌습니다. 빛이 끊긴 도시들은 하나둘 어둠에 잠겼습니다.",
  },
  {
    id: "wake",
    title: "마지막 광부",
    bgAssetId: "/clicker/bg/loading_core_awakening.webp",
    body: "당신은 무너진 채굴 거점에서 눈을 뜹니다. 동료들은 떠났고 장비는 녹슬었지만, 발밑 깊은 곳에서 아직 희미한 맥동이 느껴집니다. 코어는 완전히 죽지 않았습니다.",
  },
  {
    id: "voice",
    title: "코어의 목소리",
    bgAssetId: "/clicker/bg/region_core_chamber.webp",
    body: "\"들리나요… 광부여.\" 광맥 속에서 가느다란 목소리가 울립니다. \"나를 다시 깨우려면 힘이 필요합니다. 광석을 캐고, 그 빛으로 기계를 돌려 주세요. 빛이 모이면, 길이 열립니다.\"",
  },
  {
    id: "worlds",
    title: "끊어진 길",
    bgAssetId: "/clicker/region/signal_relay_still.webp",
    body: "코어에서 뻗어 나간 길은 이제 폐허가 되었습니다. 신호가 끊긴 중계 복도, 수정 타이탄이 지키는 위상 금고, 뇌운 드래곤이 둥지를 튼 폭풍의 첨탑, 용암 베히모스가 잠든 심연의 단층. 힘을 모을수록 하나씩 다시 열립니다.",
  },
  {
    id: "guardians",
    title: "길을 막는 자들",
    bgAssetId: "/clicker/region/storm_spire_still.webp",
    body: "각 지역의 보스는 코어의 빛을 먹고 자랐습니다. 맨손으로는 상대할 수 없습니다. 지역에서 모은 재료로 대장간에서 무기와 갑옷을 벼려야 그들의 둥지에 들어갈 수 있습니다.",
  },
  {
    id: "worldline",
    title: "세계선",
    bgAssetId: "/clicker/rebirth/rebirth_key_visual_void_tear_v1.png",
    body: "\"한 번의 삶으로는 부족합니다.\" 코어가 말합니다. 충분한 빛이 모이면 세계를 무너뜨리고 다시 시작할 수 있습니다. 모든 것을 잃는 대신, 당신은 더 강한 세계선에서 다시 태어납니다. 그 힘은 다음 생으로 이어집니다.",
  },
  {
    id: "oath",
    title: "여덟 번의 생",
    bgAssetId: "/clicker/bg/transcendence_room_base.webp",
    body: "여덟 개의 세계선을 건너 강해진 자만이 심장부에 닿을 수 있습니다. 그곳에서 수호자를 쓰러뜨리면 코어는 다시 숨을 쉬고, 꺼져 가던 세계에 새벽이 옵니다.",
  },
  {
    id: "begin",
    title: "첫 번째 곡괭이질",
    bgAssetId: "/clicker/bg/tutorial2_relic_vault.webp",
    body: "당신은 녹슨 곡괭이를 집어 듭니다. 광산 입구 너머로 푸른 광맥이 깜빡입니다. 첫 번째 세계선의 이야기가 지금 시작됩니다.",
  },
  { id: "mine", title: "광산 입장", body: "Enter Mine을 누르면 제한 시간 동안 광석을 캘 수 있습니다. 누를수록 CORE가 쌓입니다." },
  { id: "space", title: "키보드", body: "광산 안에서 스페이스바를 꾹 누르면 1초에 5번씩 계속 채굴합니다(전체 상한 11회/초). 숫자 1~9 키로 보유한 스킬을 바로 씁니다." },
  { id: "build", title: "생산과 강화", body: "아래 메뉴에서 생산자를 사면 CORE가 자동으로 들어옵니다. 강화와 스킬 회로로 더 빨라집니다." },
  { id: "world", title: "지역", body: "지역마다 다른 활동과 도전이 있습니다. 새 지역이 열리면 상단에서 바로 이동하세요." },
]

export const REBIRTH_CHAMBER_REMINDER = "새 세계선. 더 강해진 손으로 다시 광맥을 깨우세요."
