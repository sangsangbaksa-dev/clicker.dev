import { dispatchAuthApi } from "@/infrastructure/http/auth-dispatch"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteParams = { params: Promise<{ segments: string[] }> }

async function segmentsOf(params: RouteParams["params"]): Promise<string[]> {
  return (await params).segments ?? []
}

export async function GET(request: Request, ctx: RouteParams) {
  return dispatchAuthApi(request, await segmentsOf(ctx.params))
}

export async function POST(request: Request, ctx: RouteParams) {
  return dispatchAuthApi(request, await segmentsOf(ctx.params))
}

export async function PATCH(request: Request, ctx: RouteParams) {
  return dispatchAuthApi(request, await segmentsOf(ctx.params))
}

export async function PUT(request: Request, ctx: RouteParams) {
  return dispatchAuthApi(request, await segmentsOf(ctx.params))
}

export async function DELETE(request: Request, ctx: RouteParams) {
  return dispatchAuthApi(request, await segmentsOf(ctx.params))
}
