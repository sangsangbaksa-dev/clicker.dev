/**
 * Static file server that mimics GitHub project Pages URL layout (repo segment in path, files at out/ root).
 */
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { join, extname } from "node:path"
import { fileURLToPath } from "node:url"

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
}

export function createGitHubPagesStaticServer({
  host,
  port,
  basePath,
  outDir = fileURLToPath(new URL("../out", import.meta.url)),
}) {
  const origin = `http://${host}:${port}`
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", origin)
      let pathname = url.pathname
      if (basePath && pathname.startsWith(basePath)) {
        pathname = pathname.slice(basePath.length) || "/"
      }
      if (!pathname.startsWith("/")) pathname = `/${pathname}`

      let filePath = join(outDir, pathname)
      if (pathname.endsWith("/")) filePath = join(filePath, "index.html")
      let body
      try {
        body = await readFile(filePath)
      } catch {
        if (!extname(pathname)) {
          body = await readFile(join(outDir, "404.html"))
          res.statusCode = 404
        } else {
          res.statusCode = 404
          res.end("Not found")
          return
        }
      }
      res.setHeader("content-type", MIME[extname(filePath)] ?? "application/octet-stream")
      res.end(body)
    } catch (err) {
      res.statusCode = 500
      res.end(String(err))
    }
  })

  const listen = () =>
    new Promise((resolve, reject) => {
      server.once("error", reject)
      server.listen(port, host, resolve)
    })

  const close = () => new Promise((resolve) => server.close(() => resolve()))

  return { server, listen, close, origin }
}
