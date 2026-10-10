/* eslint-disable @typescript-eslint/no-require-imports -- Electron main process is CommonJS. */
// Aurelia Core — offline desktop app.
// Serves the static export bundled in ./game over a private app:// origin, so absolute paths
// (/_next/…, /clicker/…) resolve, localStorage saves persist between launches, and video
// seeking works (Range requests). No network is needed.
const { app, BrowserWindow, protocol, session, shell, Menu } = require("electron")
const fs = require("node:fs")
const path = require("node:path")

const GAME_DIR = path.join(__dirname, "game")
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
}

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
])

function resolveFile(urlPath) {
  let rel = decodeURIComponent(urlPath.split("?")[0])
  if (rel.endsWith("/")) rel += "index.html"
  const file = path.normalize(path.join(GAME_DIR, rel))
  if (!file.startsWith(GAME_DIR)) return null
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file
  if (!path.extname(file) && fs.existsSync(path.join(file, "index.html"))) return path.join(file, "index.html")
  return null
}

function serve(request) {
  const url = new URL(request.url)
  const file = resolveFile(url.pathname)
  if (!file) {
    const notFound = path.join(GAME_DIR, "404.html")
    return new Response(fs.existsSync(notFound) ? fs.readFileSync(notFound) : "Not found", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  }
  const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream"
  const size = fs.statSync(file).size
  const range = request.headers.get("range")
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    let start = m && m[1] ? Number(m[1]) : 0
    let end = m && m[2] ? Number(m[2]) : size - 1
    if (m && !m[1] && m[2]) {
      start = Math.max(0, size - Number(m[2]))
      end = size - 1
    }
    end = Math.min(end, size - 1)
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
    const fd = fs.openSync(file, "r")
    const buf = Buffer.alloc(end - start + 1)
    fs.readSync(fd, buf, 0, buf.length, start)
    fs.closeSync(fd)
    return new Response(buf, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(buf.length),
        "Accept-Ranges": "bytes",
      },
    })
  }
  return new Response(fs.readFileSync(file), {
    status: 200,
    headers: { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes" },
  })
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 360,
    minHeight: 600,
    backgroundColor: "#070B12",
    title: "Aurelia Core",
    icon: path.join(GAME_DIR, "clicker", "icon", "icon_core.png"),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  // External links open in the system browser, never inside the game window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: "deny" }
  })
  win.loadURL("app://game/")
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  protocol.handle("app", serve)
  // Fonts are bundled; anything still pointing at Google Fonts is served locally instead.
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["https://fonts.googleapis.com/*", "https://fonts.gstatic.com/*"] },
    (details, cb) => {
      if (details.url.startsWith("https://fonts.googleapis.com/css")) cb({ redirectURL: "app://game/fonts/fonts.css" })
      else cb({ cancel: true })
    },
  )
  createWindow()
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
