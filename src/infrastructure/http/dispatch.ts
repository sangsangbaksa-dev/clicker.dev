import { NextResponse } from "next/server"

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export function notFound(): Response {
  return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } })
}

export function methodNotAllowed(): Response {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: { "Cache-Control": "no-store" } })
}

export async function dispatchByMethod(
  request: Request,
  handlers: Partial<Record<HttpMethod, (request: Request) => Promise<Response>>>,
): Promise<Response> {
  const method = request.method as HttpMethod
  const handler = handlers[method]
  if (!handler) return methodNotAllowed()
  return handler(request)
}
