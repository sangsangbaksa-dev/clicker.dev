"use client"

/**
 * Client-only DI bootstrap. Server Components that import infrastructure bindings only run
 * on the server, so module-level ports stay unbound in the browser bundle unless we import
 * the adapters from a Client Component.
 */
import { bindClickerBgmPortFactory } from "@/application/clicker-bgm-engine"
import {
  bindClickerCompletionRecords,
  bindClickerPersistence,
  bindClickerTabLock,
} from "@/application/clicker-client-bind"
import { createHtmlClickerBgmPorts } from "@/infrastructure/audio/html-clicker-bgm-ports"
import { browserClickerCompletionRecords } from "@/infrastructure/persistence/clicker-completion-records"
import { browserClickerPersistence } from "@/infrastructure/persistence/clicker-persistence-adapter"
import { browserClickerTabLock } from "@/infrastructure/persistence/clicker-tab-lock-adapter"
import { sharedAudioContext } from "@/lib/clicker-sfx"

bindClickerPersistence(browserClickerPersistence)
bindClickerTabLock(browserClickerTabLock)
bindClickerCompletionRecords(browserClickerCompletionRecords)

bindClickerBgmPortFactory(() =>
  createHtmlClickerBgmPorts({
    resumeSharedContext() {
      const c = sharedAudioContext()
      if (c && c.state !== "running" && c.state !== "closed") void c.resume().catch(() => {})
    },
    sharedAudioContext,
  }),
)

export function ClickerClientBootstrap({ children }: { children: React.ReactNode }) {
  return children
}
