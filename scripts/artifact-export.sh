#!/usr/bin/env bash
# Builds the clicker game as a static site that can be published as a
# claude.ai Artifact (relative paths, no `_next/` folder, no API routes).
#
#   scripts/artifact-export.sh [OUT_DIR]
#
# The repo itself is not touched: the build runs in a scratch copy that keeps
# only the game page, and the result lands in OUT_DIR (default: artifact-out/).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/artifact-out}"
WORK="${ARTIFACT_WORK_DIR:-$ROOT/.artifact-build}"

rm -rf "$WORK"
mkdir -p "$WORK"
for f in src public package.json tsconfig.json postcss.config.mjs components.json next-env.d.ts; do
  [ -e "$ROOT/$f" ] && cp -R "$ROOT/$f" "$WORK/"
done
ln -sfn "$ROOT/node_modules" "$WORK/node_modules"

# Keep only the game: server routes and the school board can't be exported.
(
  cd "$WORK/src/app"
  find . -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
  rm -f loading.tsx
)

cat > "$WORK/next.config.ts" <<'EOF'
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
  // CI typechecks the full app; this copy drops server-only data files.
  typescript: { ignoreBuildErrors: true },
  devIndicators: false,
  experimental: { optimizePackageImports: ["lucide-react"] },
}

export default nextConfig
EOF

(cd "$WORK" && rm -rf .next out && NEXT_TELEMETRY_DISABLED=1 npx next build >/dev/null)

rm -rf "$OUT"
mkdir -p "$OUT"
cp -R "$WORK/out/." "$OUT/"
mv "$OUT/_next" "$OUT/nx"
rm -rf "$OUT/404" "$OUT/404.html" "$OUT/_not-found" "$OUT/_not-found.html" "$OUT"/*.txt "$OUT"/__next.* 2>/dev/null || true
# Only the game assets under public/clicker are used; drop the rest.
find "$OUT" -maxdepth 1 -mindepth 1 -type d ! -name nx ! -name clicker -exec rm -rf {} +
# Art that only exists as a lossless source next to a WebP copy is never loaded.
find "$OUT/clicker" -name '*.gif' -delete

# Artifacts are served from a sub-path, so every root-absolute URL becomes
# relative. HTML/JS resolve against the page; CSS resolves against its own file.
node - "$OUT" <<'EOF'
const fs = require("fs")
const path = require("path")
const out = process.argv[2]
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])
for (const file of walk(out)) {
  const ext = path.extname(file)
  if (![".html", ".js", ".css", ".webmanifest", ".json"].includes(ext)) continue
  let text = fs.readFileSync(file, "utf8")
  const before = text
  if (ext === ".css") {
    const up = path.relative(path.dirname(file), out).split(path.sep).join("/") + "/"
    text = text.replace(/\/_next\//g, up + "nx/").replace(/url\((["']?)\/(clicker|favicon|icon|apple-icon)/g, `url($1${up}$2`)
  } else {
    // indexOf("/_next/") is how Next finds its own asset prefix in a script src.
    text = text
      .replace(/indexOf\((["'`])\/_next\/\1\)/g, "indexOf($1/nx/$1)")
      .replace(/(["'`(])\/_next\//g, "$1./nx/")
      .replace(/(["'`(])\/(clicker\/|favicon\.ico|icon\.png|apple-icon\.png|manifest\.webmanifest)/g, "$1./$2")
  }
  // The artifact host rejects a literal U+FFFD; in JS it only appears inside strings.
  if (ext === ".js") text = text.replace(/\uFFFD/g, "\\ufffd")
  if (text !== before) fs.writeFileSync(file, text)
}
EOF

echo "$OUT"
