import type { SchoolNoteKind, SchoolNotes } from "@/domain/entities/board"

export const SCHOOL_NOTE_LEVELS = ["s", "a", "b", "c", "d", "e"] as const

export type SchoolNoteLevel = (typeof SCHOOL_NOTE_LEVELS)[number]

export const ENGLISH_SCHOOL_NOTE_KINDS = SCHOOL_NOTE_LEVELS.map(
  (level) => `english_${level}` as SchoolNoteKind
)

export const MATH_SCHOOL_NOTE_KINDS = SCHOOL_NOTE_LEVELS.map(
  (level) => `math_${level}` as SchoolNoteKind
)

export const SCHOOL_NOTE_KINDS: SchoolNoteKind[] = [
  ...ENGLISH_SCHOOL_NOTE_KINDS,
  ...MATH_SCHOOL_NOTE_KINDS,
]

export const SCHOOL_LEVEL_LABELS: Record<SchoolNoteLevel, string> = {
  s: "S반",
  a: "A반",
  b: "B반",
  c: "C반",
  d: "D반",
  e: "E반",
}

export const SCHOOL_NOTE_LABELS: Record<SchoolNoteKind, string> = {
  english_s: "영어 S반",
  english_a: "영어 A반",
  english_b: "영어 B반",
  english_c: "영어 C반",
  english_d: "영어 D반",
  english_e: "영어 E반",
  math_s: "수학 S반",
  math_a: "수학 A반",
  math_b: "수학 B반",
  math_c: "수학 C반",
  math_d: "수학 D반",
  math_e: "수학 E반",
}

export function emptySchoolNotes(): SchoolNotes {
  const notes = {} as SchoolNotes
  for (const kind of SCHOOL_NOTE_KINDS) {
    notes[kind] = ""
  }
  return notes
}

export function normalizeSchoolNotes(raw: Partial<SchoolNotes> | undefined): SchoolNotes {
  const base = emptySchoolNotes()
  if (!raw || typeof raw !== "object") return base
  for (const kind of SCHOOL_NOTE_KINDS) {
    base[kind] = String(raw[kind] ?? "")
  }
  return base
}

export function sanitizeSchoolNotes(input: Partial<SchoolNotes> | undefined): SchoolNotes {
  const normalized = normalizeSchoolNotes(input)
  const next = emptySchoolNotes()
  for (const kind of SCHOOL_NOTE_KINDS) {
    next[kind] = normalized[kind].slice(0, 20_000)
  }
  return next
}

export function schoolNoteLabel(kind: SchoolNoteKind | string | undefined): string | undefined {
  if (!kind || typeof kind !== "string") return undefined
  return kind in SCHOOL_NOTE_LABELS
    ? SCHOOL_NOTE_LABELS[kind as SchoolNoteKind]
    : undefined
}

export function isSchoolNoteKind(kind: string): kind is SchoolNoteKind {
  return kind in SCHOOL_NOTE_LABELS
}

export function validateSchoolLevel(value: unknown): value is SchoolNoteLevel {
  return (
    typeof value === "string" &&
    SCHOOL_NOTE_LEVELS.includes(value as SchoolNoteLevel)
  )
}

export function schoolLevelValidationError(value: unknown): string | null {
  if (validateSchoolLevel(value)) return null
  return "S반, A, B, C, D, E반 중 하나를 선택해 주세요."
}

export function formatEnglishLevel(level: SchoolNoteLevel): string {
  return `영어 ${SCHOOL_LEVEL_LABELS[level]}`
}

export function formatMathLevel(level: SchoolNoteLevel): string {
  return `수학 ${SCHOOL_LEVEL_LABELS[level]}`
}

export function formatUserSchoolLevels(user: {
  englishLevel?: SchoolNoteLevel
  mathLevel?: SchoolNoteLevel
}): string | null {
  const parts: string[] = []
  if (user.englishLevel) parts.push(formatEnglishLevel(user.englishLevel))
  if (user.mathLevel) parts.push(formatMathLevel(user.mathLevel))
  return parts.length > 0 ? parts.join(" · ") : null
}

export function englishNoteKindForLevel(level: SchoolNoteLevel): SchoolNoteKind {
  return `english_${level}` as SchoolNoteKind
}

export function mathNoteKindForLevel(level: SchoolNoteLevel): SchoolNoteKind {
  return `math_${level}` as SchoolNoteKind
}
