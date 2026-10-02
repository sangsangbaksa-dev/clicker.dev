import { clickerAccountFromCookies } from "@/infrastructure/auth/clicker-session"
import { clickerAccountStorageMissing, clickerAccountStorageReady } from "@/infrastructure/persistence/clicker-accounts"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const storage = clickerAccountStorageReady()
  return NextResponse.json({
    account: await clickerAccountFromCookies(),
    storage,
    ...(storage ? {} : { missing: clickerAccountStorageMissing() }),
  })
}
