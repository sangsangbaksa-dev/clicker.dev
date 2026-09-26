/**
 * 요청 본문을 JSON 객체로 읽는다. 본문이 비었거나 깨졌거나 객체가 아니면 `{}`를 돌려준다.
 * `request.json()`을 그대로 쓰면 잘못된 본문 하나로 500이 나고, `null` 본문은 필드 접근에서 터진다.
 */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json()
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}
