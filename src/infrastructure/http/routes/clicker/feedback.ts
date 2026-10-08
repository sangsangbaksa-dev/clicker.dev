import {
  validateClickerFeedbackSubmission,
  type ClickerFeedback,
} from "@/domain/services/clicker-feedback"
import { addClickerFeedback, listClickerFeedback } from "@/infrastructure/persistence/clicker-feedback"
import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ACCESS_HANDLE = "@kk960399"
const MAX_REQUEST_BYTES = 10_000
const noStore = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > MAX_REQUEST_BYTES) return noStore({ error: "요청이 너무 큽니다." }, 413)

  let body: Record<string, unknown>
  try {
    const text = await request.text()
    if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
      return noStore({ error: "요청이 너무 큽니다." }, 413)
    }
    const parsed: unknown = JSON.parse(text)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return noStore({ error: "잘못된 요청입니다." }, 400)
    }
    body = parsed as Record<string, unknown>
  } catch {
    return noStore({ error: "요청을 읽지 못했습니다." }, 400)
  }

  if (body.action === "list") {
    if (typeof body.handle !== "string" || body.handle.trim() !== ACCESS_HANDLE) {
      return noStore({ error: "아이디를 확인해 주세요." }, 403)
    }
    try {
      return noStore({ entries: await listClickerFeedback() })
    } catch (error) {
      return noStore(
        { error: error instanceof Error ? error.message : "피드백을 불러오지 못했습니다." },
        503,
      )
    }
  }

  if (body.action !== "submit") return noStore({ error: "잘못된 요청입니다." }, 400)
  const submission = validateClickerFeedbackSubmission(body)
  if (!submission.ok) return noStore({ error: submission.error }, 400)

  const entry: ClickerFeedback = {
    id: randomUUID(),
    ...submission.value,
    createdAt: new Date().toISOString(),
  }

  try {
    await addClickerFeedback(entry)
    return noStore({ entry }, 201)
  } catch (error) {
    return noStore(
      { error: error instanceof Error ? error.message : "피드백을 저장하지 못했습니다." },
      503,
    )
  }
}
