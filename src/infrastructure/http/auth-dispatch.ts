import { dispatchByMethod, notFound } from "@/infrastructure/http/dispatch"
import * as accessLevel from "@/infrastructure/http/routes/auth/access-level"
import * as approve from "@/infrastructure/http/routes/auth/approve"
import * as bootstrap from "@/infrastructure/http/routes/auth/bootstrap"
import * as clearRecords from "@/infrastructure/http/routes/auth/clear-records"
import * as contentHold from "@/infrastructure/http/routes/auth/content-hold"
import * as contentReport from "@/infrastructure/http/routes/auth/content-report"
import * as login from "@/infrastructure/http/routes/auth/login"
import * as logout from "@/infrastructure/http/routes/auth/logout"
import * as me from "@/infrastructure/http/routes/auth/me"
import * as members from "@/infrastructure/http/routes/auth/members"
import * as membersRestore from "@/infrastructure/http/routes/auth/members-restore"
import * as pending from "@/infrastructure/http/routes/auth/pending"
import * as profile from "@/infrastructure/http/routes/auth/profile"
import * as profileRequests from "@/infrastructure/http/routes/auth/profile-requests"
import * as purgeNonWaldo from "@/infrastructure/http/routes/auth/purge-non-waldo"
import * as reject from "@/infrastructure/http/routes/auth/reject"
import * as remove from "@/infrastructure/http/routes/auth/remove"
import * as signup from "@/infrastructure/http/routes/auth/signup"

const routes: Record<string, Partial<Record<string, (request: Request) => Promise<Response>>>> = {
  "access-level": { PATCH: accessLevel.PATCH },
  approve: { POST: approve.POST },
  bootstrap: { GET: bootstrap.GET },
  "clear-records": { POST: clearRecords.POST },
  "content-hold": { POST: contentHold.POST },
  "content-report": { POST: contentReport.POST },
  login: { POST: login.POST },
  logout: { POST: logout.POST },
  me: { GET: me.GET },
  members: { GET: members.GET, PATCH: members.PATCH },
  "members/restore": { POST: membersRestore.POST },
  pending: { GET: pending.GET },
  profile: { GET: profile.GET, PATCH: profile.PATCH },
  "profile-requests": { GET: profileRequests.GET, POST: profileRequests.POST },
  "purge-non-waldo": { POST: purgeNonWaldo.POST },
  reject: { POST: reject.POST },
  remove: { POST: remove.POST },
  signup: { POST: signup.POST },
}

export async function dispatchAuthApi(request: Request, segments: string[]): Promise<Response> {
  const key = segments.join("/")
  const handlers = routes[key]
  if (!handlers) return notFound()
  return dispatchByMethod(request, handlers)
}
