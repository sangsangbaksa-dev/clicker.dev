import { NextResponse } from "next/server"
import { type UseCaseResult } from "./use-case-result.ts"

export { fail, ok, type UseCaseResult } from "./use-case-result.ts"

export function toJson<T>(
  result: UseCaseResult<T>,
  mapValue: (value: T) => unknown,
  noStore = true
): NextResponse {
  const headers = noStore ? { "Cache-Control": "no-store" } : undefined
  if (result.ok) return NextResponse.json(mapValue(result.value), { headers })
  const body: Record<string, unknown> = { error: result.error }
  if (result.conflict) body.conflict = true
  if (result.payload && typeof result.payload === "object") Object.assign(body, result.payload)
  return NextResponse.json(body, { status: result.status, headers })
}
