import { resolveAccessLevel } from "@/domain/services/access-level"
import type { AccessLevel, SessionUser } from "@/domain/entities/user"
import { resolveAuthSecret } from "@/infrastructure/auth/auth-secret"
import { SignJWT, jwtVerify } from "jose"

export const SESSION_COOKIE = "sohaengbang-session"
const SESSION_DAYS = 30

function secretKey(): Uint8Array {
  return new TextEncoder().encode(resolveAuthSecret(process.env))
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    loginId: user.loginId,
    name: user.name,
    status: user.status,
    accessLevel: user.accessLevel,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey())
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey())
    const id = payload.sub
    const loginId = payload.loginId
    const name = payload.name
    const status = payload.status
    const accessLevel = payload.accessLevel
    if (
      typeof id !== "string" ||
      typeof loginId !== "string" ||
      typeof name !== "string"
    ) {
      return null
    }
    const resolvedStatus = status === "pending" ? "pending" : "approved"
    const resolvedLevel: AccessLevel =
      typeof accessLevel === "string" &&
      (accessLevel === "viewer" ||
        accessLevel === "author" ||
        accessLevel === "admin")
        ? accessLevel
        : resolveAccessLevel({ loginId, accessLevel: undefined })
    return {
      id,
      loginId,
      name,
      status: resolvedStatus,
      accessLevel: resolveAccessLevel({ loginId, accessLevel: resolvedLevel }),
    }
  } catch {
    return null
  }
}

export function sessionCookieOptions(token: string) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  }
}

export function clearSessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  }
}

export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("cookie")
  if (!header) return null
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=")
    if (rawName === SESSION_COOKIE) {
      const value = rest.join("=")
      return value ? decodeURIComponent(value) : null
    }
  }
  return null
}

export async function getSessionFromRequest(
  request: Request
): Promise<SessionUser | null> {
  const token = readSessionToken(request)
  if (!token) return null
  return verifySessionToken(token)
}
