import {
  DEFAULT_ORIGIN_HOST,
  applyEdgeResponseHeaders,
  edgeCacheTtlSeconds,
  forwardHeaders,
  originUrlFor,
  shouldCacheAtEdge,
  shouldStoreAtEdge,
} from "./rewrite"

export interface Env {
  ORIGIN_HOST: string
}

function publicOrigin(request: Request): { origin: string; host: string } {
  const url = new URL(request.url)
  const proto = request.headers.get("X-Forwarded-Proto") || url.protocol.replace(":", "")
  return { origin: `${proto}://${url.host}`, host: url.host }
}

function cacheControlFor(pathname: string): string {
  const ttl = edgeCacheTtlSeconds(pathname)
  if (ttl >= 31_536_000) return "public, max-age=31536000, immutable"
  return `public, max-age=${ttl}`
}

type WaitUntil = { waitUntil(promise: Promise<unknown>): void }

export default {
  async fetch(request: Request, env: Env, ctx: WaitUntil): Promise<Response> {
    const originHost = env.ORIGIN_HOST || DEFAULT_ORIGIN_HOST
    const incoming = new URL(request.url)
    const originUrl = originUrlFor(incoming, originHost)
    const { origin: siteOrigin, host: siteHost } = publicOrigin(request)
    const cacheable = shouldCacheAtEdge(request.method, incoming.pathname)

    const originRequest = new Request(originUrl.toString(), {
      method: request.method,
      headers: forwardHeaders(request.headers, siteHost, originHost),
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    })

    if (!cacheable) {
      const originResponse = await fetch(originRequest)
      const headers = applyEdgeResponseHeaders(
        originResponse.headers,
        siteOrigin,
        originHost
      )
      if (incoming.pathname.startsWith("/api/")) {
        headers.set("Cache-Control", "private, no-store")
        headers.set("CDN-Cache-Control", "no-store")
      }
      headers.set("X-HSMS-Edge", "BYPASS")
      return new Response(originResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers,
      })
    }

    const cache = caches.default
    const cacheKey = new Request(originUrl.toString(), { method: "GET" })
    const cached = await cache.match(cacheKey)
    if (cached) {
      const headers = new Headers(cached.headers)
      headers.set("X-HSMS-Edge", "HIT")
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      })
    }

    const originResponse = await fetch(originRequest)
    const headers = applyEdgeResponseHeaders(
      originResponse.headers,
      siteOrigin,
      originHost
    )
    headers.set("Cache-Control", cacheControlFor(incoming.pathname))
    headers.set("CDN-Cache-Control", cacheControlFor(incoming.pathname))
    headers.set("X-HSMS-Edge", "MISS")

    const response = new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers,
    })

    if (shouldStoreAtEdge(request.method, originResponse.ok)) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()))
    }

    return response
  },
}
