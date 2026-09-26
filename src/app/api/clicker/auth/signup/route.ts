import { signupClickerAccount } from "@/application/clicker-account"
import { readCredentials, sessionResponse } from "@/app/api/clicker/auth/respond"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    return await sessionResponse(await signupClickerAccount(await readCredentials(request)))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "가입하지 못했습니다." }, { status: 503 })
  }
}
