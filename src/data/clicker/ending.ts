export type EndingStep = {
  id: string
  title: string
  body: string
  accent?: string
  /** Full-screen painted backdrop (Canva) behind the card. */
  backdrop: string
}

const DIR = "/clicker/ending"

/** Shown after the guardian falls and the ending videos play. The last beat is the run's record. */
export const CLICKER_TRUE_ENDING_STEPS: EndingStep[] = [
  {
    id: "fall",
    title: "수호자의 몰락",
    accent: "CORE HEART · OPEN",
    body: "코어를 틀어막던 수호자가 무너집니다. 수천 년 막혀 있던 맥동이 한꺼번에 터져 나옵니다.",
    backdrop: `${DIR}/ending_fall.webp`,
  },
  {
    id: "breath",
    title: "코어의 첫 숨",
    accent: "AURELIA CORE · ONLINE",
    body: "AURELIA 코어가 다시 숨을 쉽니다. 멈춰 있던 굴착기와 레일이 하나둘 불을 켜고, 금빛 맥이 바위 속을 타고 번져 갑니다.",
    backdrop: `${DIR}/ending_breath.webp`,
  },
  {
    id: "worldlines",
    title: "하나로 모인 세계선",
    accent: "WORLDLINES · CONVERGED",
    body: "환생할 때마다 걸어온 세계선이 한 점으로 모여듭니다. 당신이 고른 모든 운명이 이 코어를 깨우는 열쇠였습니다.",
    backdrop: `${DIR}/ending_worldlines.webp`,
  },
  {
    id: "dawn",
    title: "새벽",
    accent: "DAWN",
    body: "꺼져 가던 세계에 불이 들어옵니다. 골짜기마다 등불이 켜지고, 광산 입구 위로 해가 떠오릅니다. 당신이 캐낸 모든 광석이 이 새벽을 위한 것이었습니다.",
    backdrop: `${DIR}/ending_dawn.webp`,
  },
  {
    id: "record",
    title: "당신의 기록",
    accent: "FINAL RECORD",
    body: "이 세계선의 여정을 기록에 새깁니다.",
    backdrop: `${DIR}/ending_dawn.webp`,
  },
]

export const CLICKER_COMPLETION_EPILOGUE = "코어는 이제 스스로 숨 쉽니다. 광산의 불빛은 다시는 꺼지지 않을 것입니다."
