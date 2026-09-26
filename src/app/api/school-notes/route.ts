import { toJson } from "@/application/result"
import { getSchoolNotesQuery, saveSchoolNotesContent } from "@/application/school-notes"
import type { SchoolNotesDocument } from "@/domain/entities/board"
import { requireApprovedUser, requireEditorUser } from "@/infrastructure/auth/guard"
import { toPublicUser } from "@/infrastructure/persistence/user-repository"
import { NextResponse } from "next/server"
import { readJsonBody } from "@/infrastructure/http/read-json-body"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const noStore = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

export async function GET(request: Request) {
  const auth = await requireApprovedUser(request)
  if (auth instanceof Response) return auth
  return toJson(await getSchoolNotesQuery(), (value) => ({
    schoolNotes: value.schoolNotes,
  }))
}

export async function PUT(request: Request) {
  const auth = await requireEditorUser(request)
  if (auth instanceof Response) return auth

  try {
    const body = (await readJsonBody(request)) as {
      schoolNotes?: Partial<SchoolNotesDocument>
      revision?: number
    }
    if (!body.schoolNotes || typeof body.revision !== "number") {
      return noStore({ error: "잘못된 요청입니다." }, 400)
    }

    return toJson(
      await saveSchoolNotesContent({
        actor: toPublicUser(auth.user),
        incoming: body.schoolNotes,
        clientRevision: body.revision,
      }),
      (value) => ({ schoolNotes: value.schoolNotes })
    )
  } catch (error) {
    return noStore(
      { error: error instanceof Error ? error.message : "저장하지 못했습니다." },
      400
    )
  }
}
