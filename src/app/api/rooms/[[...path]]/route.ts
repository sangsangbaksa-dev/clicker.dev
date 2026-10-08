import { dispatchRoomsApi } from "@/infrastructure/http/rooms-dispatch"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteParams = { params: Promise<{ path?: string[] }> }

async function pathOf(params: RouteParams["params"]): Promise<string[]> {
  return (await params).path ?? []
}

export async function GET(request: Request, ctx: RouteParams) {
  return dispatchRoomsApi(request, await pathOf(ctx.params))
}

export async function POST(request: Request, ctx: RouteParams) {
  return dispatchRoomsApi(request, await pathOf(ctx.params))
}

export async function PUT(request: Request, ctx: RouteParams) {
  return dispatchRoomsApi(request, await pathOf(ctx.params))
}

export async function PATCH(request: Request, ctx: RouteParams) {
  return dispatchRoomsApi(request, await pathOf(ctx.params))
}

export async function DELETE(request: Request, ctx: RouteParams) {
  return dispatchRoomsApi(request, await pathOf(ctx.params))
}
