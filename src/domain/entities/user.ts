export type UserStatus = "pending" | "approved"

export type AccessLevel = "viewer" | "author" | "admin"

export type ContentHold = {
  previousLevel: AccessLevel
  reason: "disallowed-content"
  snippet: string
  createdAt: string
}

/** Signup class: 1반–4반 */
export type ClassNumber = 1 | 2 | 3 | 4

/** English / math level band: S–E */
export type SchoolLevel = "s" | "a" | "b" | "c" | "d" | "e"

export type StoredUser = {
  id: string
  loginId: string
  name: string
  passwordHash: string
  status: UserStatus
  accessLevel?: AccessLevel
  /** User's class (1–4). Set at signup; legacy users backfilled from room membership. */
  classN?: ClassNumber
  englishLevel?: SchoolLevel
  mathLevel?: SchoolLevel
  approvedBy?: string
  approvedAt?: string
  createdAt: string
  /** 욕설·음란 표현으로 뷰어 강등. 소유자·관리자 허가 전까지 유지 */
  contentHold?: ContentHold
}

export type PublicUser = {
  id: string
  loginId: string
  name: string
  status: UserStatus
  accessLevel: AccessLevel
  classN?: ClassNumber
  englishLevel?: SchoolLevel
  mathLevel?: SchoolLevel
  contentHold?: ContentHold
}

export type SessionUser = PublicUser

export type ProfileChangeRequest = {
  id: string
  userId: string
  userName: string
  currentLoginId: string
  requestedLoginId?: string
  currentClassN?: ClassNumber
  requestedClassN?: ClassNumber
  currentEnglishLevel?: SchoolLevel
  requestedEnglishLevel?: SchoolLevel
  currentMathLevel?: SchoolLevel
  requestedMathLevel?: SchoolLevel
  requestedAt: string
}

export type ProfileChanges = {
  loginId?: string
  classN?: ClassNumber
  englishLevel?: SchoolLevel
  mathLevel?: SchoolLevel
}

export type UserActivityItem = {
  kind: "update" | "comment" | "note" | "task"
  roomCode: string
  roomLabel: string
  text?: string
  added?: string
  removed?: string
  noteKind?: string
  createdAt: string
  taskTitle?: string
}
