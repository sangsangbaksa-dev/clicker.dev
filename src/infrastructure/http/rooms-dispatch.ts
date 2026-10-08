import { dispatchByMethod, notFound } from "@/infrastructure/http/dispatch"
import * as roomCreate from "@/infrastructure/http/routes/rooms/create"
import * as room from "@/infrastructure/http/routes/rooms/room"
import * as messages from "@/infrastructure/http/routes/rooms/messages"
import * as messageImage from "@/infrastructure/http/routes/rooms/message-image"
import * as documents from "@/infrastructure/http/routes/rooms/documents"
import * as document from "@/infrastructure/http/routes/rooms/document"
import * as live from "@/infrastructure/http/routes/rooms/live"

type RoomCtx<T extends Record<string, string>> = { params: Promise<T> }

function roomCtx<T extends Record<string, string>>(params: T): RoomCtx<T> {
  return { params: Promise.resolve(params) }
}

export async function dispatchRoomsApi(request: Request, path: string[]): Promise<Response> {
  if (path.length === 0) {
    return dispatchByMethod(request, { POST: roomCreate.POST })
  }

  const [code, ...rest] = path
  if (!code) return notFound()

  if (rest.length === 0) {
    const ctx = roomCtx({ code })
    return dispatchByMethod(request, {
      GET: (req) => room.GET(req, ctx),
      PUT: (req) => room.PUT(req, ctx),
      PATCH: (req) => room.PATCH(req, ctx),
    })
  }

  if (rest[0] !== "groups" || rest.length < 3) return notFound()
  const groupId = rest[1]
  const resource = rest[2]

  if (resource === "messages" && rest.length === 3) {
    const ctx = roomCtx({ code, groupId })
    return dispatchByMethod(request, {
      GET: (req) => messages.GET(req, ctx),
      POST: (req) => messages.POST(req, ctx),
    })
  }

  if (resource === "messages" && rest.length === 5 && rest[3] && rest[4] === "image") {
    const messageId = rest[3]
    const ctx = roomCtx({ code, groupId, messageId })
    return dispatchByMethod(request, { GET: (req) => messageImage.GET(req, ctx) })
  }

  if (resource === "documents" && rest.length === 3) {
    const ctx = roomCtx({ code, groupId })
    return dispatchByMethod(request, {
      GET: (req) => documents.GET(req, ctx),
      POST: (req) => documents.POST(req, ctx),
    })
  }

  if (resource === "documents" && rest.length === 4) {
    const documentId = rest[3]
    const ctx = roomCtx({ code, groupId, documentId })
    return dispatchByMethod(request, {
      PUT: (req) => document.PUT(req, ctx),
      DELETE: (req) => document.DELETE(req, ctx),
    })
  }

  if (resource === "live" && rest.length === 3) {
    const ctx = roomCtx({ code, groupId })
    return dispatchByMethod(request, {
      GET: (req) => live.GET(req, ctx),
      POST: (req) => live.POST(req, ctx),
    })
  }

  return notFound()
}
