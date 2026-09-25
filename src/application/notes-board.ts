import {
  boardNotesScopeForClassKind,
  notesPanelHeading,
  notesPanelHint,
  schoolNotesFocusForClass,
  type BoardNotesScope,
  type SchoolNotesFocus,
} from "@/domain/services/notes-scope"
import { classFromCode } from "@/shared/classes"

export type NotesBoardView = {
  scope: BoardNotesScope
  heading: string
  hint: string | null
  schoolFocus: SchoolNotesFocus | null
}

/** 반 코드 → 노트 보드가 보여줄 표면. UI는 이 결과를 그리기만 한다. */
export function getNotesBoardView(classCode: string): NotesBoardView {
  const cls = classFromCode(classCode)
  const scope = boardNotesScopeForClassKind(cls?.kind)
  return {
    scope,
    heading: notesPanelHeading(scope),
    hint: notesPanelHint(scope),
    schoolFocus: scope === "school" ? schoolNotesFocusForClass(cls) : null,
  }
}
