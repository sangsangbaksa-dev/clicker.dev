import { bindClickerCuePlayer } from "@/application/clicker-cue-player"
import { createHtmlCuePlayer } from "@/infrastructure/audio/html-cue-player"

bindClickerCuePlayer(createHtmlCuePlayer())
