import { defaultClassSubjectNotes, syncLegacyNotesField } from "@/domain/services/subject-notes"
import { groupLabel } from "@/domain/services/class-groups"
import type { ClassGroup, Room } from "@/domain/entities/board"
import type { ClassNumber, SchoolLevel } from "@/domain/entities/user"
import { SCHOOL_LEVEL_LABELS, SCHOOL_NOTE_LEVELS } from "@/domain/services/school-note-kinds"

export type ClassKind = "homeroom" | "english" | "math"

export type ClassInfo = {
  n: number
  slug: string
  code: string
  label: string
  accent: string
  kind: ClassKind
  level?: SchoolLevel
}

export type HomeroomClassInfo = ClassInfo & { n: ClassNumber; kind: "homeroom" }

export const HOMEROOM_CLASSES: HomeroomClassInfo[] = [
  { n: 1, slug: "1", code: "BAN1", label: "1반", accent: "#c45c26", kind: "homeroom" },
  { n: 2, slug: "2", code: "BAN2", label: "2반", accent: "#2f6f5e", kind: "homeroom" },
  { n: 3, slug: "3", code: "BAN3", label: "3반", accent: "#355f8c", kind: "homeroom" },
  { n: 4, slug: "4", code: "BAN4", label: "4반", accent: "#8a4a6e", kind: "homeroom" },
]

const ENGLISH_ACCENTS = ["#2F6F7E", "#3a7d8c", "#458b9a", "#2a6170", "#245864", "#1e4c58"]
const MATH_ACCENTS = ["#3f6f5a", "#4a7d66", "#558b72", "#386352", "#325848", "#2c4d3e"]

export const ENGLISH_CLASSES: ClassInfo[] = SCHOOL_NOTE_LEVELS.map((level, index) => ({
  n: 11 + index,
  slug: `en-${level}`,
  code: `ENG${level.toUpperCase()}`,
  label: `영어 ${SCHOOL_LEVEL_LABELS[level]}`,
  accent: ENGLISH_ACCENTS[index] ?? "#2F6F7E",
  kind: "english" as const,
  level,
}))

export const MATH_CLASSES: ClassInfo[] = SCHOOL_NOTE_LEVELS.map((level, index) => ({
  n: 21 + index,
  slug: `ma-${level}`,
  code: `MATH${level.toUpperCase()}`,
  label: `수학 ${SCHOOL_LEVEL_LABELS[level]}`,
  accent: MATH_ACCENTS[index] ?? "#3f6f5a",
  kind: "math" as const,
  level,
}))

export const CLASSES: ClassInfo[] = [...HOMEROOM_CLASSES, ...ENGLISH_CLASSES, ...MATH_CLASSES]

export function classFromNumber(n: number): ClassInfo | null {
  return CLASSES.find((item) => item.n === n) ?? null
}

export function classFromSlug(slug: string): ClassInfo | null {
  const normalized = slug.trim().toLowerCase()
  return CLASSES.find((item) => item.slug === normalized) ?? null
}

export function classFromCode(code: string): ClassInfo | null {
  const normalized = code.trim().toUpperCase()
  return CLASSES.find((item) => item.code === normalized) ?? null
}

export function classFromParam(param: string): ClassInfo | null {
  const slug = classFromSlug(param)
  if (slug) return slug
  const numeric = Number(param)
  if (Number.isFinite(numeric)) {
    const byNumber = classFromNumber(numeric)
    if (byNumber) return byNumber
  }
  return classFromCode(param)
}

export function isClassNumber(n: number): n is ClassNumber {
  return n === 1 || n === 2 || n === 3 || n === 4
}

export function isLevelClass(info: Pick<ClassInfo, "kind">): boolean {
  return info.kind === "english" || info.kind === "math"
}

export function classCodeForNumber(n: number): string | null {
  return classFromNumber(n)?.code ?? null
}

export function userBelongsToClass(
  user: { classN?: number | null; englishLevel?: SchoolLevel; mathLevel?: SchoolLevel },
  info: Pick<ClassInfo, "kind" | "n" | "level">
): boolean {
  if (info.kind === "homeroom") return user.classN === info.n
  if (info.kind === "english") return Boolean(info.level && user.englishLevel === info.level)
  if (info.kind === "math") return Boolean(info.level && user.mathLevel === info.level)
  return false
}

export function createClassRoom(info: ClassInfo): Room {
  const createdAt = new Date().toISOString()
  const levelBoard = isLevelClass(info)
  return {
    code: info.code,
    title: `${info.label} 수행평가`,
    subject: "",
    description: levelBoard
      ? `${info.label} 보드입니다. 할 일을 넣을 때 과목은 적지 않아도 됩니다.`
      : "승인된 회원만 이 반 보드를 볼 수 있습니다. 과제가 정해지면 할 일과 노트를 함께 채워 주세요.",
    deadline: "",
    createdBy: "class",
    createdAt,
    updatedAt: createdAt,
    revision: 1,
    ...syncLegacyNotesField(defaultClassSubjectNotes(info.label)),
    members: [],
    tasks: [],
    updates: [],
    groups: [],
  }
}

export type ClassGroupSummary = {
  n: number
  name: string
  memberCount: number
  label: string
}

export type ClassSummary = {
  n: number
  slug: string
  label: string
  code: string
  title: string
  subject: string
  deadline: string
  taskCount: number
  memberCount: number
  groups: ClassGroupSummary[]
  kind: ClassKind
  level?: SchoolLevel
}

function toGroupSummaries(groups: ClassGroup[] | undefined): ClassGroupSummary[] {
  return (groups ?? []).map((group) => ({
    n: group.n,
    name: group.name,
    memberCount: group.memberIds.length,
    label: groupLabel(group),
  }))
}

export function toClassSummary(info: ClassInfo, room: Room): ClassSummary {
  return {
    n: info.n,
    slug: info.slug,
    label: info.label,
    code: info.code,
    title: room.title,
    subject: room.subject,
    deadline: room.deadline,
    taskCount: room.tasks.length,
    memberCount: room.members.length,
    groups: toGroupSummaries(room.groups),
    kind: info.kind,
    level: info.level,
  }
}
