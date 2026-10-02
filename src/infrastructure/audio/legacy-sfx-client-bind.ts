import { bindClickerSfxPort } from "@/application/clicker-sfx-events"
import { createLegacySfxPort } from "@/infrastructure/audio/legacy-sfx-adapter"

bindClickerSfxPort(createLegacySfxPort())
