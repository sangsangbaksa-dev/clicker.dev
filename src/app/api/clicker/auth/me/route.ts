import { clickerAccountFromCookies } from "@/infrastructure/auth/clicker-session"
import { clickerAccountStorageReady } from "@/infrastructure/persistence/clicker-accounts"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  return NextResponse.json({ account: await clickerAccountFromCookies(), storage: clickerAccountStorageReady() })
}
