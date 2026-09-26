import { resolveAuthSecret } from "@/infrastructure/auth/auth-secret"
import { SignJWT, jwtVerify } from "jose"

/** Separate from the school-site session: a game account never grants site access. */
export const CLICKER_SESSION_COOKIE = "clicker-session"
const SESSION_DAYS = 90
const AUDIENCE = "clicker"

export type ClickerSession = { id: string; nickname: string }

function secretKey(): Uint8Array {
  return new TextEncoder().encode(resolveAuthSecret(process.env))
}

export async function signClickerSession(session: ClickerSession): Promise<string> {
  return new SignJWT({ nickname: session.nickname })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.id)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey())
}

export async function verifyClickerSession(token: string): Promise<ClickerSession | null> {
  try {
    // The audience check keeps a site session token from passing as a game session.
    const { payload } = await jwtVerify(token, secretKey(), { audience: AUDIENCE })
    if (typeof payload.sub !== "string" || typeof payload.nickname !== "string") return null
    return { id: payload.sub, nickname: payload.nickname }
  } catch {
    return null
  }
}

function readCookie(request: Request): string | null {
  const header = request.headers.get("cookie")
  if (!header) return null
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === CLICKER_SESSION_COOKIE) return rest.join("=") ? decodeURIComponent(rest.join("=")) : null
  }
  return null
}

export async function getClickerSession(request: Request): Promise<ClickerSession | null> {
  const token = readCookie(request)
  return token ? verifyClickerSession(token) : null
}

export function clickerSessionCookie(token: string) {
  return {
    name: CLICKER_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: token ? SESSION_DAYS * 24 * 60 * 60 : 0,
  }
}
