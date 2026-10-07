/** Keyboard layout for the timed mine session (skills on number row, potions on QWERTY row). */

export const MINE_SKILL_HOTKEY_SLOTS = 9

/** Display labels for potion toolbar slots (left → right in `config.potions` order). */
export const MINE_POTION_HOTKEY_LABELS = ["Q", "W", "E", "R", "T", "Y", "U", "I", "O"] as const

const POTION_KEY_CODES = [
  "KeyQ",
  "KeyW",
  "KeyE",
  "KeyR",
  "KeyT",
  "KeyY",
  "KeyU",
  "KeyI",
  "KeyO",
] as const

export function mineSkillSlotFromKeyboard(code: string): number | null {
  if (!/^Digit[1-9]$/.test(code)) return null
  return Number(code.slice(5)) - 1
}

export function minePotionSlotFromKeyboard(code: string): number | null {
  const idx = POTION_KEY_CODES.indexOf(code as (typeof POTION_KEY_CODES)[number])
  return idx === -1 ? null : idx
}

export function minePotionHotkeyLabel(slot: number): string | null {
  return slot >= 0 && slot < MINE_POTION_HOTKEY_LABELS.length ? MINE_POTION_HOTKEY_LABELS[slot] : null
}

export function isMineHotkeyTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
}
