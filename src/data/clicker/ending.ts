export type EndingStep = {
  id: string
  title: string
  body: string
  accent?: string
}

/** Shown after the guardian falls and the ending videos play. */
export const CLICKER_TRUE_ENDING_STEPS: EndingStep[] = [
  {
    id: "fall",
    title: "수호자의 몰락",
    accent: "CORE HEART · OPEN",
    body: "코어를 틀어막던 수호자가 무너집니다. 수천 년 막혀 있던 맥동이 한꺼번에 터져 나옵니다.",
  },
  {
    id: "breath",
    title: "코어의 첫 숨",
    body: "AURELIA 코어가 다시 숨을 쉽니다. 다섯 세계선에서 모은 힘이 하나의 빛으로 모여 광산 전체를 밝힙니다.",
  },
  {
    id: "final",
    title: "새벽",
    body: "꺼져 가던 세계에 불이 들어옵니다. 당신이 캐낸 모든 광석이 이 새벽을 위한 것이었습니다.",
  },
]

export const CLICKER_COMPLETION_EPILOGUE = "코어는 이제 스스로 숨 쉽니다. 광산의 불빛은 다시는 꺼지지 않을 것입니다."
