import { dispatchClickerApi } from "@/infrastructure/http/clicker-dispatch"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteParams = { params: Promise<{ segments?: string[] }> }

async function segmentsOf(params: RouteParams["params"]): Promise<string[]> {
  return (await params).segments ?? []
}

export async function GET(request: Request, ctx: RouteParams) {
  return dispatchClickerApi(request, await segmentsOf(ctx.params))
}

export async function POST(request: Request, ctx: RouteParams) {
  return dispatchClickerApi(request, await segmentsOf(ctx.params))
}

export async function PUT(request: Request, ctx: RouteParams) {
  return dispatchClickerApi(request, await segmentsOf(ctx.params))
}
