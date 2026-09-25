const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

export function createId(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}_${rand}`
}

export function createRoomCode(): string {
  let code = ""
  const bytes = new Uint8Array(6)
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  for (const byte of bytes) {
    code += CODE_CHARS[byte % CODE_CHARS.length]
  }
  return code
}

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export const MEMBER_COLORS = [
  "#c45c26",
  "#2f6f5e",
  "#355f8c",
  "#8a4a6e",
  "#b0892e",
  "#4f6f8a",
  "#6b4c9a",
  "#3f7d62",
]

export function colorForIndex(index: number): string {
  return MEMBER_COLORS[index % MEMBER_COLORS.length]
}
