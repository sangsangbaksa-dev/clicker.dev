export type EndingStep = {
  id: string
  title: string
  body: string
  accent?: string
}

/** True ending — mystery tone, shown once before completion lock. */
export const CLICKER_TRUE_ENDING_STEPS: EndingStep[] = [
  {
    id: "overlap",
    title: "기억의 겹",
    body: "다섯 세계선이 같은 방 안에서 겹칩니다. CORE의 맥동은 하나인데, 리듬은 다섯 개입니다. 어느 것이 진짜였는지——기억은 말해 주지 않습니다.",
  },
  {
    id: "luma",
    title: "LUMA의 흔적",
    accent: "기록 #??? — LUMA",
    body: "…당신은 깨어난 적이 없습니다. 이 방은 당신을 기다리도록 설계되었고, CORE는 당신이 채굴하기 전까지 존재하지 않았을지도 모릅니다. LUMA는 이름만 남겼습니다.",
  },
  {
    id: "protocol",
    title: "AURELIA Protocol",
    accent: "TRANSCENDENCE · LOCK OPEN",
    body: "프로토콜 이름만 남았습니다. 나머지는 지워졌습니다. 문은 열리지 않습니다. 대신——당신이 열립니다.",
  },
  {
    id: "final",
    title: "마지막 선택",
    body: "Protocol을 실행하면 이 세계선은 닫힙니다. CORE는 계속 숨 쉬겠지만, 당신의 손은 더 이상 광맥에 닿지 않습니다. 되돌릴 수 없습니다.",
  },
]

export const CLICKER_COMPLETION_EPILOGUE =
  "당신이 채굴을 멈춘 자리에, CORE는 여전히 숨 쉬고 있습니다. 그 숨의 주인이 누구인지는——아무도 모릅니다."
