export const CLICKER_FEEDBACK_CATEGORIES = ["bug", "idea", "other"] as const

export type ClickerFeedbackCategory = (typeof CLICKER_FEEDBACK_CATEGORIES)[number]

export type ClickerFeedback = {
  id: string
  category: ClickerFeedbackCategory
  message: string
  author: string
  createdAt: string
}

export type ClickerFeedbackSubmission = Omit<ClickerFeedback, "id" | "createdAt">

export type ClickerFeedbackValidation =
  | { ok: true; value: ClickerFeedbackSubmission }
  | { ok: false; error: string }

export function validateClickerFeedbackSubmission(input: unknown): ClickerFeedbackValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "피드백 내용을 확인해 주세요." }
  }

  const value = input as Record<string, unknown>
  if (!CLICKER_FEEDBACK_CATEGORIES.includes(value.category as ClickerFeedbackCategory)) {
    return { ok: false, error: "피드백 종류를 선택해 주세요." }
  }
  if (typeof value.message !== "string") {
    return { ok: false, error: "피드백 내용을 입력해 주세요." }
  }

  const message = value.message.trim()
  if (message.length < 3 || message.length > 2000) {
    return { ok: false, error: "피드백은 3자 이상 2,000자 이하로 입력해 주세요." }
  }
  if (value.author !== undefined && typeof value.author !== "string") {
    return { ok: false, error: "이름을 확인해 주세요." }
  }

  const author = typeof value.author === "string" ? value.author.trim() : ""
  if (author.length > 40) {
    return { ok: false, error: "이름은 40자 이하로 입력해 주세요." }
  }

  return {
    ok: true,
    value: {
      category: value.category as ClickerFeedbackCategory,
      message,
      author,
    },
  }
}
