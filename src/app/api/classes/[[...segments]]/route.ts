import { dispatchClassesApi } from "@/infrastructure/http/classes-dispatch"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteParams = { params: Promise<{ segments?: string[] }> }

async function segmentsOf(params: RouteParams["params"]): Promise<string[]> {
  return (await params).segments ?? []
}

export async function GET(request: Request, ctx: RouteParams) {
  return dispatchClassesApi(request, await segmentsOf(ctx.params))
}
