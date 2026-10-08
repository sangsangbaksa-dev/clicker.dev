import { dispatchByMethod, notFound } from "@/infrastructure/http/dispatch"
import * as classesIndex from "@/infrastructure/http/routes/classes/index"
import * as classesRoster from "@/infrastructure/http/routes/classes/roster"

export async function dispatchClassesApi(request: Request, segments: string[]): Promise<Response> {
  const key = segments.join("/")
  if (key === "") return dispatchByMethod(request, { GET: classesIndex.GET })
  if (key === "roster") return dispatchByMethod(request, { GET: classesRoster.GET })
  return notFound()
}
