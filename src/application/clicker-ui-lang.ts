import { normalizeClickerUiLang, type ClickerUiLang } from "@/domain/services/clicker-ui-lang"

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
