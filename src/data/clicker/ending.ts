export type EndingStep = {
  id: string
  title: string
  body: string
  accent?: string
  /** Which ending video this caption overlays. */
  video?: "guardian_death" | "core_awaken"
  /** Caption fade-in / fade-out, seconds from video start. */
  showAt?: number
  hideAt?: number
}

/** Shown after the guardian falls and the ending videos play. */
export const CLICKER_TRUE_ENDING_STEPS: EndingStep[] = [
  {
    id: "fall",
    title: "수호자, 붕괴",
    accent: "CORE HEART · OPEN",
    video: "guardian_death", // 9.5s: 1.4s 마지막 타격, 4.55s 플래시, 9.0s 암전
    showAt: 1.6,
    hideAt: 4.4,
    body: "수호자가 무너진다. 수천 년 막혀 있던 맥동이 한꺼번에 터져 나온다.",
  },
  {
    id: "breath",
    title: "코어, 재가동",
    video: "guardian_death",
    showAt: 5.2,
    hideAt: 8.8,
    body: "AURELIA 코어가 다시 숨을 쉰다. 세계선마다 모아 온 힘이 하나의 빛으로 합쳐져 광산 전체를 밝힌다.",
  },
  {
    id: "final",
    title: "새벽",
    video: "core_awaken", // 10s: 박동 가속, 8.75s 화이트아웃
    showAt: 2.0,
    hideAt: 8.4,
    body: "꺼져 가던 세계에 불이 들어온다. 네가 캐낸 모든 광석은 이 새벽을 위한 것이었다.",
  },
]

export const CLICKER_COMPLETION_EPILOGUE = "코어는 이제 스스로 숨 쉰다. 광산의 불빛은 다시는 꺼지지 않는다."
