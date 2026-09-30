import { bindClickerPersistence, bindClickerTabLock } from "@/application/clicker-client-bind"
import { browserClickerPersistence } from "@/infrastructure/persistence/clicker-persistence-adapter"
import { browserClickerTabLock } from "@/infrastructure/persistence/clicker-tab-lock-adapter"

bindClickerPersistence(browserClickerPersistence)
bindClickerTabLock(browserClickerTabLock)
