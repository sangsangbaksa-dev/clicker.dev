import { getClickerSession } from "@/infrastructure/auth/clicker-session"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/** Who is signed in to the game (null when nobody). Never an error: guests are normal. */
export async function GET(request: Request) {
  const account = await getClickerSession(request)
  return NextResponse.json({ account }, { headers: { "Cache-Control": "no-store" } })
}
