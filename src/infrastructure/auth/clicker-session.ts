import { resolveAuthSecret } from "@/infrastructure/auth/auth-secret"
import { SignJWT, jwtVerify } from "jose"
import type { ClickerPublicAccount } from "@/application/clicker-account"

export const CLICKER_SESSION_COOKIE = "clicker-session"
const DAYS = 30

const key = () => new TextEncoder().encode(resolveAuthSecret(process.env))

export async function signClickerSession(a: ClickerPublicAccount): Promise<string> {
  return new SignJWT({ loginId: a.loginId, nickname: a.nickname })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(a.id)
    .setIssuedAt()
    .setExpirationTime(`${DAYS}d`)
    .sign(key())
}

export async function readClickerSession(request: Request): Promise<ClickerPublicAccount | null> {
  const header = request.headers.get("cookie") ?? ""
  const raw = header
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${CLICKER_SESSION_COOKIE}=`))
  if (!raw) return null
  try {
    const { payload } = await jwtVerify(decodeURIComponent(raw.slice(CLICKER_SESSION_COOKIE.length + 1)), key())
    if (typeof payload.sub !== "string" || typeof payload.loginId !== "string" || typeof payload.nickname !== "string") return null
    return { id: payload.sub, loginId: payload.loginId, nickname: payload.nickname }
  } catch {
    return null
  }
}

export function clickerSessionCookie(token: string, clear = false) {
  return {
    name: CLICKER_SESSION_COOKIE,
    value: clear ? "" : token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: clear ? 0 : DAYS * 24 * 60 * 60,
  }
}
