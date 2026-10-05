/**
 * GitHub Pages builds set NEXT_PUBLIC_CLICKER_STATIC_HOST=1 (see next.config.ts pages export).
 * The clicker runs client-only there — no /api/clicker routes.
 */
export function isClickerStaticHost(): boolean {
  return process.env.NEXT_PUBLIC_CLICKER_STATIC_HOST === "1"
}
