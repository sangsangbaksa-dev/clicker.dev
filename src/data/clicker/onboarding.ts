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
    id: "wake",
    title: "깨어남",
    bgAssetId: "/clicker/bg/loading_core_awakening.webp",
    body: "빛이 꺼진 광산에서 눈을 뜹니다. 발밑 깊은 곳에서 AURELIA 코어가 희미하게 맥동합니다.",
  },
  {
    id: "blocked",
    title: "막힌 심장",
    bgAssetId: "/clicker/bg/tutorial2_relic_vault.webp",
    body: "코어의 심장부는 거대한 수호자가 틀어막고 있습니다. 코어가 숨을 쉬지 못해 세계가 꺼져 갑니다.",
  },
  {
    id: "plan",
    title: "되살리는 길",
    bgAssetId: "/clicker/bg/transcendence_room_base.webp",
    body: "광맥을 캐 힘을 모으고, 다섯 번의 환생으로 더 강해진 뒤, 심장부의 수호자를 쓰러뜨리세요.",
  },
  { id: "mine", title: "광산 입장", body: "Enter Mine을 누르면 제한 시간 동안 광석을 캘 수 있습니다. 누를수록 CORE가 쌓입니다." },
  { id: "space", title: "키보드", body: "광산 안에서 스페이스바를 꾹 누르면 1초에 5번씩 계속 채굴합니다(전체 상한 11회/초). 숫자 1~9 키로 보유한 스킬을 바로 씁니다." },
  { id: "build", title: "생산과 강화", body: "아래 메뉴에서 생산자를 사면 CORE가 자동으로 들어옵니다. 강화와 스킬 회로로 더 빨라집니다." },
  { id: "world", title: "지역", body: "지역마다 다른 활동과 도전이 있습니다. 새 지역이 열리면 상단에서 바로 이동하세요." },
]

export const REBIRTH_CHAMBER_REMINDER = "새 세계선. 더 강해진 손으로 다시 광맥을 깨우세요."
