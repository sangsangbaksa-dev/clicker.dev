"use client"

import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/ui/button-link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ProfileRequestsPanel } from "@/components/members/profile-requests-panel"
import { UserActivityList } from "@/components/user/user-activity-list"
import type { UserActivityItem } from "@/domain/entities/user"
import { classFromNumber } from "@/shared/classes"
import { formatUserSchoolLevels } from "@/domain/services/school-note-kinds"
import type { AuthUser } from "@/domain/entities/board"
import { Spinner } from "@/components/ui/spinner"
import { Check, UserMinus } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { errorMessage, getJson } from "@/shared/get-json"

type PendingPayload = {
  pending?: AuthUser[]
  activity?: Record<string, UserActivityItem[]>
}

function requestPending() {
  return getJson<PendingPayload>("/api/auth/pending", "대기 목록을 불러오지 못했습니다.")
}

export function ApprovePanel({
  initialPending,
  initialActivity,
  initialRequests,
  initialRequestActivity,
}: {
  initialPending?: AuthUser[]
  initialActivity?: Record<string, UserActivityItem[]>
  initialRequests?: import("@/domain/entities/user").ProfileChangeRequest[]
  initialRequestActivity?: Record<string, UserActivityItem[]>
}) {
  const [pending, setPending] = useState<AuthUser[]>(initialPending ?? [])
  const [activity, setActivity] = useState<Record<string, UserActivityItem[]>>(
    initialActivity ?? {}
  )
  const [loading, setLoading] = useState(initialPending === undefined)
  const [busyId, setBusyId] = useState<string | null>(null)

  const applyPending = useCallback((payload: PendingPayload) => {
    setPending(payload.pending ?? [])
    setActivity(payload.activity ?? {})
  }, [])

  /** Quiet refetch after an action; failures are left to the next poll. */
  const load = useCallback(async () => {
    try {
      applyPending(await requestPending())
    } catch {
      // The 4s poll retries.
    }
  }, [applyPending])

  // Poll the queue; only the first load (without server data) shows the spinner and errors.
  const hasInitialPending = initialPending !== undefined
  useEffect(() => {
    let active = true
    const poll = (silent: boolean) =>
      requestPending()
        .then((payload) => {
          if (active) applyPending(payload)
        })
        .catch((error) => {
          if (active && !silent) toast.error(errorMessage(error, "목록을 불러오지 못했습니다."))
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    void poll(hasInitialPending)
    const timer = window.setInterval(() => {
      void poll(true)
    }, 4000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [applyPending, hasInitialPending])

  async function removeMember(userId: string, name: string) {
    if (!window.confirm(`${name} 가입 신청을 거절하고 계정을 삭제할까요?`)) {
      return
    }
    setBusyId(userId)
    try {
      const response = await fetch("/api/auth/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "거절에 실패했습니다.")
      }
      toast.success(`${name} 가입 신청을 거절했습니다.`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "거절에 실패했습니다.")
    } finally {
      setBusyId(null)
    }
  }

  async function approve(userId: string) {
    setBusyId(userId)
    try {
      const response = await fetch("/api/auth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "승인에 실패했습니다.")
      }
      toast.success("승인했습니다.")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "승인에 실패했습니다.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">회원 승인</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          가입 신청 목록입니다.
        </p>
      </div>

      <ProfileRequestsPanel
        initialRequests={initialRequests}
        initialActivity={initialRequestActivity}
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size="sm" />
          대기 목록 불러오는 중…
        </div>
      ) : pending.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>대기 중인 회원 없음</CardTitle>
            <CardDescription>가입 신청이 있으면 여기에 표시됩니다.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="space-y-3">
          {pending.map((user) => (
            <li key={user.id}>
              <Card>
                <CardContent className="space-y-3 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.loginId}
                        {user.classN ? (
                          <span className="ml-2 text-foreground/80">
                            · {classFromNumber(user.classN)?.label ?? `${user.classN}반`}
                          </span>
                        ) : null}
                        {formatUserSchoolLevels(user) ? (
                          <span className="ml-2 text-foreground/80">
                            · {formatUserSchoolLevels(user)}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      disabled={busyId === user.id}
                      onClick={() => void removeMember(user.id, user.name)}
                    >
                      {busyId === user.id ? (
                        <Spinner size="xs" label="처리 중" />
                      ) : (
                        <UserMinus />
                      )}
                      거절
                    </Button>
                    <Button
                      size="sm"
                      disabled={busyId === user.id}
                      onClick={() => void approve(user.id)}
                    >
                      {busyId === user.id ? (
                        <Spinner size="xs" label="처리 중" />
                      ) : (
                        <Check />
                      )}
                      승인
                    </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5 border-t border-border/60 pt-3">
                    <p className="text-xs font-medium text-muted-foreground">전체 글</p>
                    <UserActivityList
                      items={activity[user.id] ?? []}
                      emptyLabel="활동 기록 없음"
                    />
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ButtonLink href="/" variant="ghost">
        ← 홈
      </ButtonLink>
    </div>
  )
}
