import { loadLeaderboard } from "@/application/game-account"
import { clickerAccountFromCookies } from "@/infrastructure/auth/clicker-session"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Public ranking: ?kind=clear (fastest true ending, default) or ?kind=core (lifetime CORE). */
export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind") === "core" ? "core" : "clear"
  const account = await clickerAccountFromCookies().catch(() => null)
  try {
    return NextResponse.json(await loadLeaderboard(kind, account?.id ?? null))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "랭킹을 불러오지 못했습니다." },
      { status: 503 },
    )
  }
}
