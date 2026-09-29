/** Painted world-currency glyph; the emoji in the region data stays as the plain-text fallback. */
export function CurrencyIcon({ regionId, fallback }: { regionId: string; fallback?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="clicker-currency-icon"
      src={`/clicker/currency/${regionId}.svg`}
      alt={fallback ?? ""}
      width={16}
      height={16}
      draggable={false}
    />
  )
}
