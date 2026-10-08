/** Supported UI language tags (BCP 47 primary or full tag). */
export const CLICKER_UI_LANG_ALLOWED = ["ko", "en", "ja", "zh", "zh-cn", "zh-tw"] as const

export type ClickerUiLang = (typeof CLICKER_UI_LANG_ALLOWED)[number]

export const CLICKER_UI_LANG_DEFAULT: ClickerUiLang = "ko"

export const CLICKER_UI_LANG_MAX_LEN = 12

const ALLOWED = new Set<string>(CLICKER_UI_LANG_ALLOWED)

function clampTag(raw: string): string {
  return raw.trim().toLowerCase().slice(0, CLICKER_UI_LANG_MAX_LEN)
}

/** Map browser tags (e.g. en-US, zh-Hans) onto the allowed set; unknown → ko. */
export function normalizeClickerUiLang(raw: string | null | undefined): ClickerUiLang {
  if (!raw) return CLICKER_UI_LANG_DEFAULT
  const tag = clampTag(raw)
  if (ALLOWED.has(tag)) return tag as ClickerUiLang
  const [primary] = tag.split("-")
  if (primary === "zh") {
    if (tag.includes("tw") || tag.includes("hant")) return "zh-tw"
    if (tag.includes("cn") || tag.includes("hans")) return "zh-cn"
    return "zh"
  }
  if (primary && ALLOWED.has(primary)) return primary as ClickerUiLang
  return CLICKER_UI_LANG_DEFAULT
}

export type UiLangSource = {
  stored?: string | null
  navigatorLanguage?: string | null
}

/** Prefer an explicit stored tag, then the browser language, then domain default. */
export function resolveClickerUiLang(source: UiLangSource): ClickerUiLang {
  if (source.stored) return normalizeClickerUiLang(source.stored)
  if (source.navigatorLanguage) return normalizeClickerUiLang(source.navigatorLanguage)
  return normalizeClickerUiLang(null)
}
