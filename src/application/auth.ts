import { fail, ok, type UseCaseResult } from "@/application/result"
import { CONTENT_REJECT_MESSAGE, findDisallowedSnippet } from "@/domain/services/content-moderation"
import { validateSchoolLevel } from "@/domain/services/school-note-kinds"
import type { PublicUser, SchoolLevel } from "@/domain/entities/user"
import { verifyPassword } from "@/infrastructure/auth/password"
import {
  findRemovedAccount,
  removedAccountLoginMessage,
} from "@/infrastructure/persistence/removed-accounts"
import {
  createUser,
  findUserByLoginId,
  toPublicUser,
  validateClassN,
} from "@/infrastructure/persistence/user-repository"

export async function loginUser(input: {
  loginId: string
  password: string
}): Promise<UseCaseResult<{ user: PublicUser }>> {
  const loginId = input.loginId.trim()
  if (!loginId || !input.password) {
    return fail(400, "아이디와 비밀번호를 입력해 주세요.")
  }

  const stored = await findUserByLoginId(loginId)
  if (!stored) {
    const removed = await findRemovedAccount(loginId)
    if (removed && (await verifyPassword(input.password, removed.passwordHash))) {
      return fail(403, removedAccountLoginMessage(removed.reason))
    }
    return fail(401, "아이디 또는 비밀번호가 맞지 않습니다.")
  }

  if (!(await verifyPassword(input.password, stored.passwordHash))) {
    return fail(401, "아이디 또는 비밀번호가 맞지 않습니다.")
  }
  return ok({ user: toPublicUser(stored) })
}

export async function signupUser(input: {
  loginId?: string
  name?: string
  password?: string
  passwordConfirm?: string
  classN?: number
  englishLevel?: SchoolLevel
  mathLevel?: SchoolLevel
}): Promise<
  UseCaseResult<{
    user: PublicUser
    pending: boolean
    autoApproved: boolean
    message: string
  }>
> {
  const password = input.password ?? ""
  if (!input.passwordConfirm) return fail(400, "비밀번호 확인을 입력해 주세요.")
  if (password !== input.passwordConfirm) return fail(400, "비밀번호가 일치하지 않습니다.")
  if (!validateClassN(input.classN)) {
    return fail(400, "반을 선택해 주세요. (1반, 2반, 3반, 4반 중 하나)")
  }
  if (!validateSchoolLevel(input.englishLevel)) {
    return fail(400, "영어 반을 선택해 주세요. (S반, A, B, C, D, E반 중 하나)")
  }
  if (!validateSchoolLevel(input.mathLevel)) {
    return fail(400, "수학 반을 선택해 주세요. (S반, A, B, C, D, E반 중 하나)")
  }
  if (findDisallowedSnippet([input.loginId ?? "", input.name ?? ""])) {
    return fail(400, CONTENT_REJECT_MESSAGE)
  }

  try {
    const { user, autoApproved } = await createUser({
      loginId: input.loginId ?? "",
      name: input.name ?? "",
      password,
      classN: input.classN,
      englishLevel: input.englishLevel,
      mathLevel: input.mathLevel,
    })
    return ok({
      user,
      pending: user.status === "pending",
      autoApproved,
      message: autoApproved
        ? "첫 회원으로 가입했습니다. 승인 없이 이용할 수 있습니다."
        : "가입 신청이 접수되었습니다. 관리자의 승인 후 이용할 수 있습니다.",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "회원가입에 실패했습니다."
    if (/ENOENT|EACCES|EROFS|EPERM|read-only|mkdir/i.test(message)) {
      return fail(500, "가입 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.")
    }
    return fail(400, message)
  }
}
