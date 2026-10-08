import { dispatchAuthApi } from "@/infrastructure/http/auth-dispatch"
import { dispatchClassesApi } from "@/infrastructure/http/classes-dispatch"
import { dispatchClickerApi } from "@/infrastructure/http/clicker-dispatch"
import { notFound } from "@/infrastructure/http/dispatch"
import * as schoolNotes from "@/infrastructure/http/routes/school-notes"
import { dispatchRoomsApi } from "@/infrastructure/http/rooms-dispatch"
import type { HttpMethod } from "@/infrastructure/http/dispatch"

export async function dispatchApi(request: Request, path: string[]): Promise<Response> {
  if (path.length === 0) return notFound()

  const [head, ...rest] = path
  switch (head) {
    case "auth":
      return dispatchAuthApi(request, rest)
    case "clicker":
      return dispatchClickerApi(request, rest)
    case "classes":
      return dispatchClassesApi(request, rest)
    case "rooms":
      return dispatchRoomsApi(request, rest)
    case "school-notes":
      if (rest.length > 0) return notFound()
      return dispatchSchoolNotes(request)
    default:
      return notFound()
  }
}

async function dispatchSchoolNotes(request: Request): Promise<Response> {
  const method = request.method as HttpMethod
  if (method === "GET") return schoolNotes.GET(request)
  if (method === "PUT") return schoolNotes.PUT(request)
  return notFound()
}
