export const DEV_AUTH_SECRET = "sohaengbang-local-dev-secret-change-me"
export const MIN_AUTH_SECRET_LENGTH = 32

type Env = Record<string, string | undefined>

/**
 * 운영에서는 AUTH_SECRET이 반드시 있어야 한다. 예전의 공개 기본값·NETLIFY_SITE_ID
 * 대체값은 공개 저장소에서 누구나 알 수 있어 세션 JWT를 위조할 수 있었다.
 */
export function resolveAuthSecret(env: Env): string {
  const secret = env.AUTH_SECRET?.trim()
  if (secret) return secret
  if (env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET 환경 변수가 설정되지 않았습니다.")
  }
  return DEV_AUTH_SECRET
}

/** 운영 배포 빌드인지 (Vercel production, Netlify production). */
export function isProductionDeployBuild(env: Env): boolean {
  return env.VERCEL_ENV === "production" || (env.NETLIFY === "true" && env.CONTEXT === "production")
}

/** 운영 배포 빌드에서 쓸 수 없는 AUTH_SECRET이면 이유를, 괜찮으면 null을 돌려준다. */
export function authSecretDeployProblem(env: Env): string | null {
  if (!isProductionDeployBuild(env)) return null
  const secret = env.AUTH_SECRET?.trim() ?? ""
  if (!secret) return "AUTH_SECRET 환경 변수가 없습니다."
  if (secret === DEV_AUTH_SECRET) return "AUTH_SECRET이 공개된 개발용 기본값입니다."
  if (secret.length < MIN_AUTH_SECRET_LENGTH) {
    return `AUTH_SECRET은 ${MIN_AUTH_SECRET_LENGTH}자 이상이어야 합니다.`
  }
  return null
}
