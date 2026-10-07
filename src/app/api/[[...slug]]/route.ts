import { NextResponse } from "next/server"
import * as authAccessLevel from "@/app/api/auth/access-level/handler"
import * as authApprove from "@/app/api/auth/approve/handler"
import * as authBootstrap from "@/app/api/auth/bootstrap/handler"
import * as authClearRecords from "@/app/api/auth/clear-records/handler"
import * as authContentHold from "@/app/api/auth/content-hold/handler"
import * as authContentReport from "@/app/api/auth/content-report/handler"
import * as authLogin from "@/app/api/auth/login/handler"
import * as authLogout from "@/app/api/auth/logout/handler"
import * as authMe from "@/app/api/auth/me/handler"
import * as authMembers from "@/app/api/auth/members/handler"
import * as authMembersRestore from "@/app/api/auth/members/restore/handler"
import * as authPending from "@/app/api/auth/pending/handler"
import * as authProfile from "@/app/api/auth/profile/handler"
import * as authProfileRequests from "@/app/api/auth/profile-requests/handler"
import * as authPurge from "@/app/api/auth/purge-non-waldo/handler"
import * as authReject from "@/app/api/auth/reject/handler"
import * as authRemove from "@/app/api/auth/remove/handler"
import * as authSignup from "@/app/api/auth/signup/handler"
import * as classes from "@/app/api/classes/handler"
import * as classesRoster from "@/app/api/classes/roster/handler"
import * as clickerAuthLogin from "@/app/api/clicker/auth/login/handler"
import * as clickerAuthLogout from "@/app/api/clicker/auth/logout/handler"
import * as clickerAuthMe from "@/app/api/clicker/auth/me/handler"
import * as clickerAuthSignup from "@/app/api/clicker/auth/signup/handler"
import * as clickerLeaderboard from "@/app/api/clicker/leaderboard/handler"
import * as clickerSave from "@/app/api/clicker/save/handler"
import * as roomDocument from "@/app/api/rooms/[code]/groups/[groupId]/documents/[documentId]/handler"
import * as roomDocuments from "@/app/api/rooms/[code]/groups/[groupId]/documents/handler"
import * as roomLive from "@/app/api/rooms/[code]/groups/[groupId]/live/handler"
import * as roomMessageImage from "@/app/api/rooms/[code]/groups/[groupId]/messages/[messageId]/image/handler"
import * as roomMessages from "@/app/api/rooms/[code]/groups/[groupId]/messages/handler"
import * as room from "@/app/api/rooms/[code]/handler"
import * as rooms from "@/app/api/rooms/handler"
import * as schoolNotes from "@/app/api/school-notes/handler"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/** Existing route modules export one function per method. Signatures differ; the dispatcher passes request and params. */
type AnyHandler = (
  request: Request,
  context: { params: Promise<Record<string, string>> }
) => Promise<Response> | Response

function bind(fn: unknown): AnyHandler {
  return fn as AnyHandler
}

type RouteDef = {
  template: string
  methods: Partial<Record<string, AnyHandler>>
}

const routes: RouteDef[] = [
  { template: "auth/access-level", methods: { PATCH: bind(authAccessLevel.PATCH) } },
  { template: "auth/approve", methods: { POST: bind(authApprove.POST) } },
  { template: "auth/bootstrap", methods: { GET: bind(authBootstrap.GET) } },
  { template: "auth/clear-records", methods: { POST: bind(authClearRecords.POST) } },
  { template: "auth/content-hold", methods: { POST: bind(authContentHold.POST) } },
  { template: "auth/content-report", methods: { POST: bind(authContentReport.POST) } },
  { template: "auth/login", methods: { POST: bind(authLogin.POST) } },
  { template: "auth/logout", methods: { POST: bind(authLogout.POST) } },
  { template: "auth/me", methods: { GET: bind(authMe.GET) } },
  { template: "auth/members/restore", methods: { POST: bind(authMembersRestore.POST) } },
  { template: "auth/members", methods: { GET: bind(authMembers.GET), PATCH: bind(authMembers.PATCH) } },
  { template: "auth/pending", methods: { GET: bind(authPending.GET) } },
  { template: "auth/profile-requests", methods: { GET: bind(authProfileRequests.GET), POST: bind(authProfileRequests.POST) } },
  { template: "auth/profile", methods: { GET: bind(authProfile.GET), PATCH: bind(authProfile.PATCH) } },
  { template: "auth/purge-non-waldo", methods: { POST: bind(authPurge.POST) } },
  { template: "auth/reject", methods: { POST: bind(authReject.POST) } },
  { template: "auth/remove", methods: { POST: bind(authRemove.POST) } },
  { template: "auth/signup", methods: { POST: bind(authSignup.POST) } },
  { template: "classes/roster", methods: { GET: bind(classesRoster.GET) } },
  { template: "classes", methods: { GET: bind(classes.GET) } },
  { template: "clicker/auth/login", methods: { POST: bind(clickerAuthLogin.POST) } },
  { template: "clicker/auth/logout", methods: { POST: bind(clickerAuthLogout.POST) } },
  { template: "clicker/auth/me", methods: { GET: bind(clickerAuthMe.GET) } },
  { template: "clicker/auth/signup", methods: { POST: bind(clickerAuthSignup.POST) } },
  { template: "clicker/leaderboard", methods: { GET: bind(clickerLeaderboard.GET) } },
  { template: "clicker/save", methods: { GET: bind(clickerSave.GET), PUT: bind(clickerSave.PUT) } },
  {
    template: "rooms/:code/groups/:groupId/messages/:messageId/image",
    methods: { GET: bind(roomMessageImage.GET) },
  },
  {
    template: "rooms/:code/groups/:groupId/messages",
    methods: { GET: bind(roomMessages.GET), POST: bind(roomMessages.POST) },
  },
  {
    template: "rooms/:code/groups/:groupId/documents/:documentId",
    methods: { PUT: bind(roomDocument.PUT), DELETE: bind(roomDocument.DELETE) },
  },
  {
    template: "rooms/:code/groups/:groupId/documents",
    methods: { GET: bind(roomDocuments.GET), POST: bind(roomDocuments.POST) },
  },
  {
    template: "rooms/:code/groups/:groupId/live",
    methods: { GET: bind(roomLive.GET), POST: bind(roomLive.POST) },
  },
  { template: "rooms/:code", methods: { GET: bind(room.GET), PUT: bind(room.PUT), PATCH: bind(room.PATCH) } },
  { template: "rooms", methods: { POST: bind(rooms.POST) } },
  { template: "school-notes", methods: { GET: bind(schoolNotes.GET), PUT: bind(schoolNotes.PUT) } },
]

function matchTemplate(template: string, slug: string[]): Record<string, string> | null {
  const parts = template.split("/").filter(Boolean)
  if (parts.length !== slug.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < parts.length; i++) {
    const expected = parts[i]
    const got = slug[i]
    if (expected.startsWith(":")) params[expected.slice(1)] = got
    else if (expected !== got) return null
  }
  return params
}

async function dispatch(request: Request, slug: string[] | undefined): Promise<Response> {
  const parts = slug ?? []
  for (const route of routes) {
    const params = matchTemplate(route.template, parts)
    if (!params) continue
    const handler = route.methods[request.method]
    if (!handler) return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
    return handler(request, { params: Promise.resolve(params) })
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

type Ctx = { params: Promise<{ slug?: string[] }> }

export function GET(request: Request, ctx: Ctx) {
  return ctx.params.then((p) => dispatch(request, p.slug))
}
export function POST(request: Request, ctx: Ctx) {
  return ctx.params.then((p) => dispatch(request, p.slug))
}
export function PUT(request: Request, ctx: Ctx) {
  return ctx.params.then((p) => dispatch(request, p.slug))
}
export function PATCH(request: Request, ctx: Ctx) {
  return ctx.params.then((p) => dispatch(request, p.slug))
}
export function DELETE(request: Request, ctx: Ctx) {
  return ctx.params.then((p) => dispatch(request, p.slug))
}
