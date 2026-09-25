"use client"

import { AuthForm, type AuthMode } from "@/components/auth/auth-form"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import type { AuthUser } from "@/domain/entities/board"
import { defaultBoardHref } from "@/shared/approved-landing"
import { loginPageHref, safeNextPath } from "@/shared/login-next"
import { SiteMark } from "@/components/layout/site-mark"
import { PageLoading } from "@/components/layout/page-loading"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

function redirectFor(user: AuthUser, next: string) {
  if (user.status === "pending") return "/pending"
  if (next === "/pending") return defaultBoardHref(user)
  return next || "/"
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, ready } = useAuth()
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login"
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const next = safeNextPath(searchParams.get("next"))

  function handleModeChange(nextMode: AuthMode) {
    setMode(nextMode)
    router.replace(loginPageHref(nextMode, next), { scroll: false })
  }

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    if (ready && user) {
      router.replace(redirectFor(user, next))
    }
  }, [ready, user, router, next])

  if (!ready || user) {
    return <PageLoading />
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <SiteMark size={72} alt="완주화산중학교" priority />
        <div className="space-y-1">
          <h1 className="text-base font-semibold">
            {mode === "login" ? "로그인" : "회원가입"}
          </h1>
          {mode === "signup" ? (
            <p className="text-sm text-muted-foreground">
              가입 후 관리자 승인이 필요합니다.
            </p>
          ) : null}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <AuthForm
            mode={mode}
            onModeChange={handleModeChange}
            onSuccess={(signedIn) => router.replace(redirectFor(signedIn, next))}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <LoginPageContent />
    </Suspense>
  )
}
