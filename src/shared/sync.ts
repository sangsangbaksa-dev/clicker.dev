/** Client poll / autosave cadence. Keep heartbeat slower than polls so presence writes stay cheap. */
export const SYNC_VISIBLE_MS = 2_000
export const SYNC_HIDDEN_MS = 10_000
export const TEXT_SAVE_DEBOUNCE_MS = 400
export const DEFAULT_SAVE_DEBOUNCE_MS = 250
export const HEARTBEAT_MS = 20_000
export const TYPING_TTL_MS = 4_000
