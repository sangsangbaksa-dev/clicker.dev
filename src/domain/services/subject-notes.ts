import type { Room, SubjectNoteKind, SubjectNotes } from "@/domain/entities/board"

export const SUBJECT_NOTE_KINDS: SubjectNoteKind[] = [
  "general",
  "korean",
  "science",
  "social",
  "technology",
  "ethics",
  "pe",
  "music",
  "art",
]

export const SUBJECT_NOTE_LABELS: Record<SubjectNoteKind, string> = {
  general: "일반 노트",
  korean: "국어 노트",
  science: "과학 노트",
  social: "사회 노트",
  technology: "기술가정 노트",
  ethics: "도덕 노트",
  pe: "체육유도 노트",
  music: "음악 노트",
  art: "미술 노트",
}

export function emptySubjectNotes(): SubjectNotes {
  return {
    general: "",
    korean: "",
    science: "",
    social: "",
    technology: "",
    ethics: "",
    pe: "",
    music: "",
    art: "",
  }
}

export function defaultClassSubjectNotes(classLabel: string): SubjectNotes {
  return {
    ...emptySubjectNotes(),
    general: `${classLabel} 친구 모두 이 화면을 볼 수 있습니다.

- 할 일 칸에 해야 할 일 나눠 적기
- 할 일 아래 댓글로 질문·링크 남기기
- 노트에 회의에서 정한 것 남기기`,
  }
}

export function normalizeSubjectNotes(
  raw: Partial<SubjectNotes> | undefined,
  legacyNotes?: string
): SubjectNotes {
  const base = emptySubjectNotes()
  if (raw && typeof raw === "object") {
    for (const kind of SUBJECT_NOTE_KINDS) {
      base[kind] = String(raw[kind] ?? "")
    }
  }
  if (!raw && legacyNotes?.trim()) {
    base.general = legacyNotes
  } else if (raw && !raw.general?.trim() && legacyNotes?.trim()) {
    base.general = legacyNotes
  }
  return base
}

/** Keep legacy `notes` in sync with 일반 노트 for older clients. */
export function syncLegacyNotesField(
  subjectNotes: SubjectNotes
): Pick<Room, "notes" | "subjectNotes"> {
  return {
    subjectNotes,
    notes: subjectNotes.general,
  }
}

export function sanitizeSubjectNotes(input: Partial<SubjectNotes> | undefined): SubjectNotes {
  const normalized = normalizeSubjectNotes(input)
  const next = emptySubjectNotes()
  for (const kind of SUBJECT_NOTE_KINDS) {
    next[kind] = normalized[kind].slice(0, 20_000)
  }
  return next
}

export function subjectNotesEqual(a: SubjectNotes, b: SubjectNotes): boolean {
  return SUBJECT_NOTE_KINDS.every((kind) => a[kind] === b[kind])
}
