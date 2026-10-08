import { dispatchByMethod, notFound } from "@/infrastructure/http/dispatch"
import * as clickerLogin from "@/infrastructure/http/routes/clicker/auth/login"
import * as clickerLogout from "@/infrastructure/http/routes/clicker/auth/logout"
import * as clickerMe from "@/infrastructure/http/routes/clicker/auth/me"
import * as clickerSignup from "@/infrastructure/http/routes/clicker/auth/signup"
import * as clickerSave from "@/infrastructure/http/routes/clicker/save"

const routes: Record<string, Partial<Record<string, (request: Request) => Promise<Response>>>> = {
  save: { GET: clickerSave.GET, PUT: clickerSave.PUT },
  "auth/login": { POST: clickerLogin.POST },
  "auth/logout": { POST: clickerLogout.POST },
  "auth/me": { GET: clickerMe.GET },
  "auth/signup": { POST: clickerSignup.POST },
}

export async function dispatchClickerApi(request: Request, segments: string[]): Promise<Response> {
  const key = segments.join("/")
  const handlers = routes[key]
  if (!handlers) return notFound()
  return dispatchByMethod(request, handlers)
}
