"use client"

import { useMemo } from "react"
import { CloudSaveService, MailBackupService } from "@/application/clicker-gmail-backup"
import type { ParsedSaveCode } from "@/domain/services/clicker-save-transfer"
import {
  createBrowserClipboard,
  createBrowserFileDownload,
  createBrowserMailComposer,
} from "@/infrastructure/backup/browser-backup-adapters"
import { createHttpSaveRepository } from "@/infrastructure/cloud/http-save-repository"

const clockNow = () => Date.now()

/** Wires the backup use cases to their browser / HTTP adapters (composition root for settings). */
export function useClickerSaveBackup(parseCode: (code: string) => ParsedSaveCode) {
  const mail = useMemo(
    () =>
      new MailBackupService({
        mail: createBrowserMailComposer(),
        clipboard: createBrowserClipboard(),
        files: createBrowserFileDownload(),
        now: clockNow,
      }),
    [],
  )
  const cloud = useMemo(() => new CloudSaveService(createHttpSaveRepository(), parseCode), [parseCode])
  return { mail, cloud }
}
