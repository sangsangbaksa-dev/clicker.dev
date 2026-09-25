"use client"

import { Button } from "@/components/ui/button"
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
import { defaultBoardHref } from "@/shared/approved-landing"
import { PageLoading } from "@/components/layout/page-loading"
import { Clock } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function PendingPage() {
  const router = useRouter()
  const { user, ready, refresh } = useAuth()

  useEffect(() => {
    if (!ready) return
    if (!user) {
      router.replace("/login?next=/pending")
      return
    }
    if (user.status === "approved") {
      router.replace(defaultBoardHref(user))
    }
  }, [ready, user, router])

  useEffect(() => {
    if (!user || user.status !== "pending") return
    const timer = window.setInterval(() => {
      void refresh()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [user, refresh])

  if (!ready || !user) {
    return <PageLoading />
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <Clock className="size-5 text-muted-foreground" />
        <h1 className="text-base font-semibold">승인 대기</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>
            {user.name}(<UserHandle loginId={user.loginId} />)
          </CardTitle>
          <CardDescription>가입 신청을 받았습니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>관리자 승인 후 반 보드에 들어갈 수 있습니다.</p>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => void refresh()}
          >
            승인 여부 확인
          </Button>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        <SwitchAccountLink />
      </p>
    </div>
  )
}
