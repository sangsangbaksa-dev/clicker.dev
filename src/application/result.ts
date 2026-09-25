import { NextResponse } from "next/server"

export type UseCaseResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string; conflict?: boolean; payload?: unknown }

export const ok = <T>(value: T): UseCaseResult<T> => ({ ok: true, value })

export const fail = <T>(
  status: number,
  error: string,
  extra?: { conflict?: boolean; payload?: unknown }
): UseCaseResult<T> => ({ ok: false, status, error, ...extra })

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
