/** Account-backed save (the Google-signed-in copy of a run). Pure shapes + rules. */
export type CloudSaveRecord = {
  /** A normal save code (AURELIA1.…): the same payload the file/clipboard backup uses. */
  code: string
  /** savedAt of the run inside the code (game clock, ms). */
  savedAt: number
  /** Server write time (ms), informational. */
  updatedAt: number
}

export type CloudSaveAvailability =
  | { state: "unavailable" }
  | { state: "signed-out"; signInUrl: string }
  | { state: "signed-in"; email: string | null }

export const CLOUD_SAVE_MAX_CODE_LENGTH = 400_000

export type SaveAgeComparison = "cloud-newer" | "local-newer" | "same" | "unknown"

export function compareSaveAge(localSavedAt: number, cloudSavedAt: number): SaveAgeComparison {
  if (!Number.isFinite(localSavedAt) || !Number.isFinite(cloudSavedAt) || localSavedAt <= 0 || cloudSavedAt <= 0) {
    return "unknown"
  }
  if (cloudSavedAt > localSavedAt) return "cloud-newer"
  if (cloudSavedAt < localSavedAt) return "local-newer"
  return "same"
}

/** Same-origin relative path only: never follow a sign-in link to another site. */
export function safeSignInUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  if (!/^\/(?!\/)[\w\-./?=&%]*$/.test(value)) return null
  return value
}
