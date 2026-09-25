export const DEFAULT_ORIGIN_HOST = "hsms-md.vercel.app"

const STATIC_FILE =
  /\.(?:js|css|mjs|map|woff2?|ttf|otf|png|jpe?g|gif|svg|ico|webp|txt|webmanifest|json)$/i

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cdn-loop",
])

export function isStaticAsset(pathname: string): boolean {
  if (pathname.startsWith("/_next/static/")) return true
  if (pathname.startsWith("/_next/image")) return true
  if (pathname === "/favicon.ico" || pathname === "/robots.txt") return true
  return STATIC_FILE.test(pathname)
}

export function shouldCacheAtEdge(method: string, pathname: string): boolean {
  if (method !== "GET" && method !== "HEAD") return false
  if (pathname.startsWith("/api/")) return false
  return isStaticAsset(pathname)
}

/** HEAD has no body; storing it under the GET key would serve empty files later. */
export function shouldStoreAtEdge(method: string, ok: boolean): boolean {
  return ok && method === "GET"
}

export function edgeCacheTtlSeconds(pathname: string): number {
  if (pathname.startsWith("/_next/static/")) return 31_536_000
  if (/\.(?:woff2?|ttf|otf|png|jpe?g|gif|svg|ico|webp)$/i.test(pathname)) {
    return 31_536_000
  }
  if (/\.(?:js|css|mjs)$/i.test(pathname)) return 31_536_000
  return 86_400
}

export function originUrlFor(
  incoming: URL,
  originHost: string = DEFAULT_ORIGIN_HOST
): URL {
  const origin = new URL(incoming.pathname + incoming.search, `https://${originHost}`)
  origin.hash = ""
  return origin
}

export function rewriteLocation(
  location: string,
  publicOrigin: string,
  originHost: string = DEFAULT_ORIGIN_HOST
): string {
  try {
    const url = new URL(location, `https://${originHost}`)
    const host = url.hostname.toLowerCase()
    if (host === originHost.toLowerCase() || host.endsWith(".vercel.app")) {
      return `${publicOrigin}${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    return location
  }
  return location
}

export function rewriteSetCookie(value: string): string {
  return value.replace(/;\s*domain=[^;]*/gi, "")
}

export function forwardHeaders(
  incoming: Headers,
  publicHost: string,
  originHost: string = DEFAULT_ORIGIN_HOST
): Headers {
  const headers = new Headers()
  incoming.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return
    headers.append(key, value)
  })
  headers.set("Host", originHost)
  headers.set("X-Forwarded-Host", publicHost)
  headers.set("X-Forwarded-Proto", "https")
  const ip = incoming.get("CF-Connecting-IP")
  if (ip) headers.set("X-Forwarded-For", ip)
  return headers
}

export function applyEdgeResponseHeaders(
  headers: Headers,
  publicOrigin: string,
  originHost: string = DEFAULT_ORIGIN_HOST
): Headers {
  const next = new Headers(headers)
  const location = next.get("Location")
  if (location) {
    next.set("Location", rewriteLocation(location, publicOrigin, originHost))
  }
  const refresh = next.get("Refresh")
  if (refresh) {
    next.set(
      "Refresh",
      refresh.replace(
        /url=(.+)$/i,
        (_, url: string) => `url=${rewriteLocation(url.trim(), publicOrigin, originHost)}`
      )
    )
  }
  const cookies =
    typeof next.getSetCookie === "function" ? next.getSetCookie() : []
  if (cookies.length > 0) {
    next.delete("Set-Cookie")
    for (const cookie of cookies) {
      next.append("Set-Cookie", rewriteSetCookie(cookie))
    }
  } else {
    const single = next.get("Set-Cookie")
    if (single) next.set("Set-Cookie", rewriteSetCookie(single))
  }
  return next
}
