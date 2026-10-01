import { bindClickerBgmPortFactory } from "@/application/clicker-bgm-client-bind"
import { createHtmlClickerBgmPorts } from "@/infrastructure/audio/html-clicker-bgm-ports"
import { sharedAudioContext } from "@/lib/clicker-sfx"

bindClickerBgmPortFactory(() =>
  createHtmlClickerBgmPorts({
    resumeSharedContext() {
      const c = sharedAudioContext()
      if (c && c.state !== "running" && c.state !== "closed") void c.resume().catch(() => {})
    },
    sharedAudioContext,
  }),
)
