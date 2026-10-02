import "server-only"

import type { ClickerAccountPublic } from "@/domain/services/clicker-account"
import { resolveAuthSecret } from "@/infrastructure/auth/auth-secret"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"

/** Game login, kept apart from the school app's session. */
export const CLICKER_SESSION_COOKIE = "aurelia-clicker-session"
const SESSION_DAYS = 60

const key = () => new TextEncoder().encode(resolveAuthSecret(process.env))

export async function signClickerSession(account: ClickerAccountPublic): Promise<string> {
  return new SignJWT({ loginId: account.loginId, nickname: account.nickname, kind: "clicker" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(account.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key())
}

export async function verifyClickerSession(token: string | undefined): Promise<ClickerAccountPublic | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key())
    if (payload.kind !== "clicker" || typeof payload.sub !== "string") return null
    if (typeof payload.loginId !== "string" || typeof payload.nickname !== "string") return null
    return { id: payload.sub, loginId: payload.loginId, nickname: payload.nickname }
  } catch {
    return null
  }
}

export async function clickerAccountFromCookies(): Promise<ClickerAccountPublic | null> {
  const store = await cookies()
  return verifyClickerSession(store.get(CLICKER_SESSION_COOKIE)?.value)
}

export function setClickerSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(CLICKER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export function clearClickerSessionCookie(response: NextResponse): void {
  response.cookies.set(CLICKER_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}
