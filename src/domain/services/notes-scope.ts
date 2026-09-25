import type { SchoolNoteKind } from "@/domain/entities/board"
import type { SchoolLevel } from "@/domain/entities/user"
import {
  englishNoteKindForLevel,
  mathNoteKindForLevel,
} from "@/domain/services/school-note-kinds"
import type { ClassKind } from "@/shared/classes"

/** 보드가 보여주는 노트 표면. UI 토글로 바꾸지 않는다. */
export type BoardNotesScope = "class" | "school"

export type SchoolNotesSubject = "english" | "math"

export type SchoolNotesFocus = {
  subject: SchoolNotesSubject
  kind: SchoolNoteKind
}

export function boardNotesScopeForClassKind(
  kind: ClassKind | null | undefined
): BoardNotesScope {
  if (kind === "english" || kind === "math") return "school"
  return "class"
}

export function schoolNotesFocusForClass(
  cls:
    | {
        kind: ClassKind
        level?: SchoolLevel
      }
    | null
    | undefined
): SchoolNotesFocus | null {
  if (!cls?.level) return null
  if (cls.kind === "english") {
    return { subject: "english", kind: englishNoteKindForLevel(cls.level) }
  }
  if (cls.kind === "math") {
    return { subject: "math", kind: mathNoteKindForLevel(cls.level) }
  }
  return null
}

export function notesPanelHeading(scope: BoardNotesScope): string {
  return scope === "school" ? "영어·수학 노트" : "반별 노트"
}

export function notesPanelHint(scope: BoardNotesScope): string | null {
  if (scope === "school") return null
  return "1~4반은 반별 노트만 씁니다. 같은 반 구성원과 공유됩니다."
}

export function notesPanelPermissionHint(
  scope: BoardNotesScope,
  canEdit: boolean
): string | null {
  if (canEdit) return null
  return scope === "class"
    ? "반 노트는 해당 반 회원만 수정할 수 있습니다."
    : "영어·수학 노트는 가입 시 선택한 영어·수학 반만 수정할 수 있습니다."
}
