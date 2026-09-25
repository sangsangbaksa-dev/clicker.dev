"use client"

import { useAuthInitialUser } from "@/components/auth/auth-initial-context"
import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/ui/button-link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SwitchAccountLink } from "@/components/auth/switch-account-link"
import { UserHandle } from "@/components/user/user-handle"
import { useAuth } from "@/hooks/use-auth"
import { Spinner } from "@/components/ui/spinner"
import { Clock, Lock } from "lucide-react"
import { buildLoginHref, buildSignupHref } from "@/shared/login-next"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect } from "react"

function LoginPrompt({
  loginHref,
  signupHref,
  needsFirstMember,
}: {
  loginHref: string
  signupHref: string
  needsFirstMember: boolean
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center sm:px-6">
      <Lock className="size-5 text-muted-foreground" />
      <div className="space-y-1">
        <h1 className="text-base font-semibold">로그인 필요</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {needsFirstMember
            ? "첫 가입자는 승인 없이 이용할 수 있습니다."
            : "회원만 이용할 수 있습니다."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {needsFirstMember ? (
          <ButtonLink href={signupHref}>첫 회원 가입하기</ButtonLink>
        ) : (
          <>
            <ButtonLink href={loginHref}>로그인</ButtonLink>
            <ButtonLink href={signupHref} variant="outline">
              회원가입
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  )
}

function SessionCheckSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-16 sm:px-6 sm:py-20">
      <Spinner size="sm" label="세션 확인 중" />
    </div>
  )
}

export function AuthAccessGate({ children }: { children: React.ReactNode }) {
  const initialUser = useAuthInitialUser()
  const { user, ready, refresh } = useAuth()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const loginHref = buildLoginHref(pathname, searchParams.toString())
  const signupHref = buildSignupHref(loginHref)
  const needsFirstMember = false

  useEffect(() => {
    if (!user || user.status !== "pending") return
    const timer = window.setInterval(() => {
      void refresh()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [user, refresh])

  const loginPrompt = (
    <LoginPrompt
      loginHref={loginHref}
      signupHref={signupHref}
      needsFirstMember={needsFirstMember}
    />
  )

  if (!ready) {
    if (!user && !initialUser) {
      return loginPrompt
    }
    if (initialUser?.status === "approved") {
      return children
    }
    return <SessionCheckSkeleton />
  }

  if (!user) {
    return loginPrompt
  }

  if (user.status === "pending") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 sm:px-6">
        <Clock className="size-5 text-muted-foreground" />
        <Card className="w-full text-left">
          <CardHeader>
            <CardTitle>승인 대기 중</CardTitle>
            <CardDescription>
              {user.name}(<UserHandle loginId={user.loginId} />) — 가입 신청 접수됨
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>관리자 승인 후 이용할 수 있습니다.</p>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              승인 여부 확인
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <SwitchAccountLink />
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return children
}
