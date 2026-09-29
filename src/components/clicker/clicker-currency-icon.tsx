/** Painted world-currency icon (Canva art, keyed by scripts/clicker-icons.py); the emoji in the region data stays as the plain-text fallback. */
export function CurrencyIcon({ regionId, fallback }: { regionId: string; fallback?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="clicker-currency-icon"
      src={`/clicker/currency/${regionId}.webp`}
      alt={fallback ?? ""}
      width={16}
      height={16}
      draggable={false}
    />
  )
}
