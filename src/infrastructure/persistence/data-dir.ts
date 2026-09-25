import path from "node:path"

function rootDir(): string {
  const override = process.env.DATA_DIR?.trim()
  if (override) return override
  if (process.env.VERCEL || process.env.NETLIFY) return "/tmp/hsms-data"
  return path.join(process.cwd(), "data")
}

export function dataPath(...segments: string[]): string {
  // Runtime data only (written on first use, /tmp on Vercel/Netlify): keep the bundler from
  // tracing the whole project, public/ included, into every server function.
  return path.join(/*turbopackIgnore: true*/ rootDir(), ...segments)
}

export function isReadonlyFsError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code ?? "")
      : ""
  if (code === "ENOENT" || code === "EACCES" || code === "EROFS" || code === "EPERM") {
    return true
  }
  const message = error instanceof Error ? error.message : String(error ?? "")
  return /ENOENT|EACCES|EROFS|EPERM|read-only/i.test(message)
}
