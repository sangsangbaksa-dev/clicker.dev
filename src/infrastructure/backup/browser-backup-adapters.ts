import type {
  ClipboardPort,
  FileDownloadPort,
  MailComposerPort,
} from "../../application/clicker-backup-ports.ts"

/** Gmail compose opens in a new tab (the game keeps running); mailto: hands off to the OS mail app. */
export function createBrowserMailComposer(): MailComposerPort {
  return {
    open(url, channel) {
      if (typeof window === "undefined") return false
      try {
        if (channel === "mailto") {
          window.location.href = url
          return true
        }
        return window.open(url, "_blank", "noopener,noreferrer") !== null
      } catch {
        return false
      }
    },
  }
}

export function createBrowserClipboard(): ClipboardPort {
  return {
    async writeText(text) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        return false
      }
    },
  }
}

export function createBrowserFileDownload(): FileDownloadPort {
  return {
    download(fileName, text) {
      try {
        const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
        const a = document.createElement("a")
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        return true
      } catch {
        return false
      }
    },
  }
}
