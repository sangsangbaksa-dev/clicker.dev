/** Only allow same-origin relative paths in post-login redirects. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/"
  const trimmed = next.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/"
  return trimmed
}

export function loginNextPath(
  pathname: string | null | undefined,
  search: string | null | undefined
): string {
  const path = pathname || "/"
  const query = search?.trim()
  return query ? `${path}?${query}` : path
}

export function buildLoginHref(
  pathname: string | null | undefined,
  search: string | null | undefined
): string {
  if (pathname === "/login") {
    const query = search?.trim()
    if (!query) return "/login"
    const params = new URLSearchParams(query)
    params.delete("mode")
    const qs = params.toString()
    return qs ? `/login?${qs}` : "/login"
  }
  if (!pathname) return "/login"
  return `/login?next=${encodeURIComponent(loginNextPath(pathname, search))}`
}

export function buildSignupHref(loginHref: string): string {
  const query = loginHref.includes("?") ? loginHref.split("?")[1] : ""
  const params = new URLSearchParams(query)
  params.set("mode", "signup")
  return `/login?${params.toString()}`
}

export function loginPageHref(
  mode: "login" | "signup",
  next: string | null | undefined
): string {
  const params = new URLSearchParams()
  const safeNext = safeNextPath(next)
  if (safeNext !== "/") {
    params.set("next", safeNext)
  }
  if (mode === "signup") {
    params.set("mode", "signup")
  }
  const qs = params.toString()
  return qs ? `/login?${qs}` : "/login"
}
