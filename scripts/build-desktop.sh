#!/usr/bin/env bash
# Offline desktop builds (Windows / Linux zip) of the clicker: static export with no base path,
# Google Fonts bundled locally, wrapped in the Electron shell in desktop/.
# 사용: bash scripts/build-desktop.sh [workdir]   → <workdir>/dist/AureliaCore-*.zip
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
work="${1:-$repo/../aurelia-desktop-build}"
rm -rf "$work"
mkdir -p "$work/src"

# 1) Static export in a throwaway copy (prepare-pages.sh deletes server routes).
(cd "$repo" && git ls-files -z | xargs -0 -I{} cp --parents {} "$work/src/")
cp -al "$repo/node_modules" "$work/src/node_modules" 2>/dev/null || cp -r "$repo/node_modules" "$work/src/node_modules"
(cd "$work/src" && PAGES_BASE_PATH= bash scripts/prepare-pages.sh && GITHUB_PAGES=1 PAGES_BASE_PATH= NODE_ENV=production npx next build)

# 2) Bundle the fonts and point every page at the local copy.
python3 - "$work/src/out" <<'PY'
import concurrent.futures as cf, hashlib, os, re, subprocess, sys, urllib.request
out = sys.argv[1]
html = open(os.path.join(out, "index.html"), encoding="utf-8").read()
m = re.search(r'href="(https://fonts\.googleapis\.com/css2[^"]+)"', html)
os.makedirs(os.path.join(out, "fonts"), exist_ok=True)
if m:
    href = m.group(1).replace("&amp;", "&")
    req = urllib.request.Request(href, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"})
    css = urllib.request.urlopen(req, timeout=30).read().decode()
    urls = sorted(set(re.findall(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", css)))
    def get(u):
        name = hashlib.sha1(u.encode()).hexdigest()[:16] + ".woff2"
        subprocess.run(["curl", "-sSf", "--max-time", "60", "-o", os.path.join(out, "fonts", name), u], check=True)
        return u, name
    with cf.ThreadPoolExecutor(12) as ex:
        for u, name in ex.map(get, urls):
            css = css.replace(u, "/fonts/" + name)
    open(os.path.join(out, "fonts", "fonts.css"), "w").write(css)
    for root, _, files in os.walk(out):
        for f in files:
            if f.endswith((".html", ".txt")):
                p = os.path.join(root, f)
                s = open(p, encoding="utf-8").read()
                s2 = re.sub(r'https://fonts\.googleapis\.com/css2\?family=.{0,160}?display=swap', "/fonts/fonts.css", s)
                if s2 != s:
                    open(p, "w", encoding="utf-8").write(s2)
PY

# 3) Electron shell + game, packaged for Windows and Linux.
mkdir -p "$work/app"
cp "$repo/desktop/main.js" "$repo/desktop/package.json" "$work/app/"
cp -r "$work/src/out" "$work/app/game"
rm -rf "$work/app/game/vocasky" "$work/app/game/brand"
cd "$work/app"
npm install --no-audit --no-fund --save-dev electron@44 @electron/packager@20 >/dev/null
for target in win32 linux; do
  npx @electron/packager . AureliaCore --platform=$target --arch=x64 --out=dist --overwrite --asar --ignore="^/dist"
  cp "$repo/desktop/README-KO.txt" "dist/AureliaCore-$target-x64/"
done
cd dist
zip -qry AureliaCore-win-x64.zip AureliaCore-win32-x64
zip -qry AureliaCore-linux-x64.zip AureliaCore-linux-x64
ls -la "$work/app/dist"/*.zip
