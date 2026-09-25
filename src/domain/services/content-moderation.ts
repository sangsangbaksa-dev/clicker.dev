export const CONTENT_HOLD_USER_MESSAGE =
  "부적절한 표현이 감지되어 해당 내용은 저장되지 않았습니다. 뷰어로 조정되었으며, 소유자 또는 관리자가 허가할 때까지 작성을 할 수 없습니다."

export const CONTENT_REJECT_MESSAGE =
  "욕설이나 음란한 표현은 사용할 수 없습니다."

const DISALLOWED_TERMS = [
  "시발",
  "씨발",
  "ㅅㅂ",
  "ㅆㅂ",
  "병신",
  "븅신",
  "지랄",
  "좆",
  "존나",
  "꺼져",
  "개새끼",
  "개새",
  "개소리",
  "니애미",
  "느금마",
  "창녀",
  "보지",
  "자지",
  "섹스",
  "야동",
  "포르노",
  "음란",
  "변태",
  "강간",
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "dick",
  "pussy",
  "cock",
  "slut",
  "whore",
  "porn",
  "nigger",
  "faggot",
]

function normalizeForScan(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s._\-*/\\|()[\]{}'"`~!?,:;]+/g, "")
    .replace(/4/g, "a")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
}

export function findDisallowedSnippet(texts: readonly string[]): string | null {
  for (const raw of texts) {
    const text = String(raw ?? "")
    if (!text.trim()) continue
    const normalized = normalizeForScan(text)
    for (const term of DISALLOWED_TERMS) {
      if (normalized.includes(normalizeForScan(term))) {
        return text.trim().slice(0, 80)
      }
    }
  }
  return null
}

export function addedTexts(previous: readonly string[], next: readonly string[]): string[] {
  const prior = new Map<string, number>()
  for (const item of previous) {
    const key = String(item ?? "")
    if (!key) continue
    prior.set(key, (prior.get(key) ?? 0) + 1)
  }
  const seen = new Map<string, number>()
  const added: string[] = []
  for (const item of next) {
    const key = String(item ?? "")
    if (!key) continue
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    if (count > (prior.get(key) ?? 0)) added.push(key)
  }
  return added
}
