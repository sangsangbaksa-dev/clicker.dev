import { bindClickerPersistence, bindClickerTabLock } from "../../application/clicker-client-bind.ts"
import { browserClickerPersistence } from "./clicker-persistence-adapter.ts"
import { browserClickerTabLock } from "./clicker-tab-lock-adapter.ts"

bindClickerPersistence(browserClickerPersistence)
bindClickerTabLock(browserClickerTabLock)
