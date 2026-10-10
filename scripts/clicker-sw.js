/* Aurelia Core offline service worker (template).
 * scripts/build-offline.mjs copies this to out/sw.js after the static export and fills in
 * __BASE__ (the Pages base path) and __VERSION__ (a hash of the build).
 *
 * - App shell (HTML, JS, CSS, manifest, icon) is cached on install, so the game opens offline.
 * - Every game asset (images, videos, audio) is cached the first time it is used, and the
 *   whole set can be fetched at once with a "download-all" message from the page.
 * - Videos are served from cache with Range support, so <video> seeks work offline.
 */
const BASE = "__BASE__"
const VERSION = "__VERSION__"
const SHELL_CACHE = `aurelia-shell-${VERSION}`
const ASSET_CACHE = "aurelia-assets-v1"
const FONT_CACHE = "aurelia-fonts-v1"
const MANIFEST_URL = `${BASE}/offline-manifest.json`

async function readManifest() {
  const res = await fetch(MANIFEST_URL, { cache: "no-store" })
  if (!res.ok) throw new Error(`offline manifest ${res.status}`)
  return res.json()
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const manifest = await readManifest()
      const cache = await caches.open(SHELL_CACHE)
      await cache.addAll(manifest.shell)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith("aurelia-shell-") && k !== SHELL_CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

/** Serve a byte range out of a cached full response (video seeking). */
async function rangeResponse(full, rangeHeader) {
  const buf = await full.arrayBuffer()
  const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader || "")
  const size = buf.byteLength
  let start = m && m[1] ? Number(m[1]) : 0
  let end = m && m[2] ? Number(m[2]) : size - 1
  if (m && !m[1] && m[2]) {
    start = Math.max(0, size - Number(m[2]))
    end = size - 1
  }
  end = Math.min(end, size - 1)
  if (start > end || start >= size) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": full.headers.get("Content-Type") || "application/octet-stream",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
    },
  })
}

async function fromCaches(request) {
  const url = new URL(request.url)
  const key = url.origin + url.pathname
  return (await caches.match(key, { ignoreSearch: true })) || null
}

async function assetFirst(request) {
  const range = request.headers.get("range")
  const hit = await fromCaches(request)
  if (hit) return range ? rangeResponse(hit, range) : hit
  if (range) {
    // Not cached yet: stream from the network, and fill the cache with the whole file in the background.
    const url = new URL(request.url)
    fetch(url.origin + url.pathname)
      .then((res) => res.ok && res.status === 200 && caches.open(ASSET_CACHE).then((c) => c.put(url.origin + url.pathname, res)))
      .catch(() => {})
    return fetch(request)
  }
  const res = await fetch(request)
  if (res.ok && res.status === 200) {
    const url = new URL(request.url)
    const copy = res.clone()
    caches.open(ASSET_CACHE).then((c) => c.put(url.origin + url.pathname, copy))
  }
  return res
}

async function shellNavigation(request) {
  try {
    const res = await fetch(request)
    if (res.ok) {
      const copy = res.clone()
      caches.open(SHELL_CACHE).then((c) => c.put(`${BASE}/`, copy))
    }
    return res
  } catch {
    return (await caches.match(`${BASE}/`)) || (await caches.match(`${BASE}/index.html`)) || Response.error()
  }
}

async function fontFirst(request) {
  const cache = await caches.open(FONT_CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  try {
    const res = await fetch(request)
    if (res.ok || res.type === "opaque") cache.put(request, res.clone())
    return res
  } catch {
    return Response.error()
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(fontFirst(request))
    return
  }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(`${BASE}/`)) return
  if (request.mode === "navigate") {
    event.respondWith(shellNavigation(request))
    return
  }
  if (url.pathname.endsWith("/sw.js") || url.pathname.endsWith("/offline-manifest.json")) return
  event.respondWith(assetFirst(request))
})

/** Fetch and cache every asset in the manifest, reporting progress to the page. */
async function downloadAll(port) {
  const manifest = await readManifest()
  const cache = await caches.open(ASSET_CACHE)
  const todo = []
  let doneBytes = 0
  for (const a of manifest.assets) {
    const key = new URL(a.url, self.location.origin).href
    if (await caches.match(key)) doneBytes += a.size
    else todo.push(a)
  }
  const total = manifest.total
  port.postMessage({ type: "progress", doneBytes, total })
  let failed = 0
  const worker = async () => {
    for (;;) {
      const a = todo.shift()
      if (!a) return
      try {
        const res = await fetch(a.url, { cache: "no-cache" })
        if (!res.ok) throw new Error(String(res.status))
        await cache.put(new URL(a.url, self.location.origin).href, res)
        doneBytes += a.size
      } catch {
        failed++
      }
      port.postMessage({ type: "progress", doneBytes, total })
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
  // Fonts: the stylesheet and the font files it points at.
  try {
    const fontCache = await caches.open(FONT_CACHE)
    for (const href of manifest.fonts || []) {
      const css = await fetch(href, { signal: AbortSignal.timeout(8000) })
      await fontCache.put(href, css.clone())
      const text = await css.text()
      for (const m of text.matchAll(/url\((https:[^)]+)\)/g)) {
        const f = await fetch(m[1], { mode: "cors", signal: AbortSignal.timeout(8000) })
        await fontCache.put(m[1], f)
      }
    }
  } catch {
    /* fonts fall back to system fonts offline */
  }
  port.postMessage({ type: "done", doneBytes, total, failed })
}

async function status(port) {
  const manifest = await readManifest().catch(() => null)
  if (!manifest) return port.postMessage({ type: "status", doneBytes: 0, total: 0 })
  let doneBytes = 0
  for (const a of manifest.assets) {
    if (await caches.match(new URL(a.url, self.location.origin).href)) doneBytes += a.size
  }
  port.postMessage({ type: "status", doneBytes, total: manifest.total })
}

self.addEventListener("message", (event) => {
  const port = event.ports && event.ports[0]
  if (!port) return
  if (event.data && event.data.type === "download-all") event.waitUntil(downloadAll(port))
  if (event.data && event.data.type === "status") event.waitUntil(status(port))
})
