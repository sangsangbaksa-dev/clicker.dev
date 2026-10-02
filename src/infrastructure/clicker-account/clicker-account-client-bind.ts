import { bindClickerAccountClient } from "@/application/clicker-account-client-bind"
import { createBrowserClickerAccountClient } from "./browser-clicker-account-client"

const client = createBrowserClickerAccountClient()
bindClickerAccountClient(client)
client.initSaveSlotFromSession()
