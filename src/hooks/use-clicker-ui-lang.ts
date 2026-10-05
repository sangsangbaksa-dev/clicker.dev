"use client"

import { useCallback, useEffect, useState } from "react"
import {
  normalizeClickerUiLang,
  resolveClickerUiLang,
  type ClickerUiLang,
} from "@/domain/services/clicker-ui-lang"
import {
  readNavigatorUiLang,
  readStoredUiLang,
  writeStoredUiLang,
} from "@/infrastructure/audio/browser-ui-lang-source"

/** Resolves UI language from storage → navigator → ko, with a setter that persists. */
export function useClickerUiLang(): [ClickerUiLang, (tag: string) => void] {
  const [lang, setLang] = useState<ClickerUiLang>(() =>
    resolveClickerUiLang({ stored: readStoredUiLang(), navigatorLanguage: readNavigatorUiLang() }),
  )

  useEffect(() => {
    setLang(
      resolveClickerUiLang({ stored: readStoredUiLang(), navigatorLanguage: readNavigatorUiLang() }),
    )
  }, [])

  const save = useCallback((raw: string) => {
    const next = normalizeClickerUiLang(raw)
    writeStoredUiLang(next)
    setLang(next)
  }, [])

  return [lang, save]
}
