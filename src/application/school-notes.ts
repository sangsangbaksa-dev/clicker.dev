import { rejectDisallowedContent } from "@/application/moderation"
import { fail, ok, type UseCaseResult } from "@/application/result"
import { canEditSchoolNotes } from "@/domain/services/access-level"
import { addedTexts } from "@/domain/services/content-moderation"
import type { SchoolNotesDocument } from "@/domain/entities/board"
import type { PublicUser } from "@/domain/entities/user"
import {
  getSchoolNotesFresh,
  mergeSchoolNotesByEditPermission,
  readSchoolNotes,
  recordSchoolNotesHistory,
  sanitizeSchoolNotesInput,
  saveSchoolNotes,
  touchSchoolNotes,
} from "@/infrastructure/persistence/school-notes-repository"
import { SharedStoreUnavailableError } from "@/infrastructure/persistence/shared-store-error"

const CONFLICT = "다른 친구가 먼저 저장했습니다."
const STORE_UNAVAILABLE = "전교 노트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."

function isSparseSchoolNotes(doc: SchoolNotesDocument): boolean {
  return (
    doc.revision <= 1 &&
    Object.values(doc.notes).every((value) => !String(value ?? "").trim())
  )
}

export async function getSchoolNotesQuery(): Promise<
  UseCaseResult<{ schoolNotes: SchoolNotesDocument }>
> {
  try {
    const { doc, unreliable, confirmedEmpty } = await readSchoolNotes()
    if (unreliable && isSparseSchoolNotes(doc) && !confirmedEmpty) {
      return fail(503, STORE_UNAVAILABLE)
    }
    return ok({ schoolNotes: doc })
  } catch (error) {
    if (error instanceof SharedStoreUnavailableError) {
      return fail(503, error.message || STORE_UNAVAILABLE)
    }
    return fail(400, error instanceof Error ? error.message : STORE_UNAVAILABLE)
  }
}

export async function saveSchoolNotesContent(input: {
  actor: PublicUser
  incoming: Partial<SchoolNotesDocument>
  clientRevision: number
}): Promise<UseCaseResult<{ schoolNotes: SchoolNotesDocument }>> {
  if (!canEditSchoolNotes(input.actor)) {
    return fail(403, "전교 노트를 수정할 권한이 없습니다.")
  }

  try {
    const current = await getSchoolNotesFresh()
    if (input.clientRevision !== current.revision) {
      return fail(409, CONFLICT, { conflict: true, payload: { schoolNotes: current } })
    }
    const latest = await getSchoolNotesFresh()
    if (input.clientRevision !== latest.revision) {
      return fail(409, CONFLICT, { conflict: true, payload: { schoolNotes: latest } })
    }

    const incomingNotes = Object.values(input.incoming.notes ?? {})
    const blocked = await rejectDisallowedContent(
      input.actor,
      addedTexts(Object.values(latest.notes ?? {}), incomingNotes)
    )
    if (blocked) return blocked

    const merged = touchSchoolNotes(
      recordSchoolNotesHistory(
        mergeSchoolNotesByEditPermission(
          sanitizeSchoolNotesInput(input.incoming, latest),
          latest,
          input.actor
        ),
        latest,
        input.actor
      )
    )
    await saveSchoolNotes(merged)
    return ok({ schoolNotes: merged })
  } catch (error) {
    if (error instanceof SharedStoreUnavailableError) {
      return fail(503, error.message || STORE_UNAVAILABLE)
    }
    return fail(400, error instanceof Error ? error.message : "저장하지 못했습니다.")
  }
}
