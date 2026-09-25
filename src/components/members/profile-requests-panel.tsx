"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UserActivityList } from "@/components/user/user-activity-list"
import type { ProfileChangeRequest, UserActivityItem } from "@/domain/entities/user"
import { classFromNumber } from "@/shared/classes"
import {
  formatEnglishLevel,
  formatMathLevel,
  formatUserSchoolLevels,
} from "@/domain/services/school-note-kinds"
import { Spinner } from "@/components/ui/spinner"
import { Check, UserMinus } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

export function ProfileRequestsPanel({
  initialRequests,
  initialActivity,
}: {
  initialRequests?: ProfileChangeRequest[]
  initialActivity?: Record<string, UserActivityItem[]>
} = {}) {
  const [requests, setRequests] = useState<ProfileChangeRequest[]>(initialRequests ?? [])
  const [activity, setActivity] = useState<Record<string, UserActivityItem[]>>(
    initialActivity ?? {}
  )
  const [loading, setLoading] = useState(initialRequests === undefined)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const response = await fetch("/api/auth/profile-requests", {
        cache: "no-store",
        credentials: "same-origin",
      })
      const payload = (await response.json()) as {
        requests?: ProfileChangeRequest[]
        activity?: Record<string, UserActivityItem[]>
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "요청 목록을 불러오지 못했습니다.")
      }
      setRequests(payload.requests ?? [])
      setActivity(payload.activity ?? {})
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "목록을 불러오지 못했습니다.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(initialRequests !== undefined)
  }, [load])

  async function handleAction(requestId: string, action: "approve" | "reject") {
    setBusyId(requestId)
    try {
      const response = await fetch("/api/auth/profile-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ requestId, action }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "처리에 실패했습니다.")
      }
      toast.success(action === "approve" ? "프로필 변경을 승인했습니다." : "변경 요청을 거절했습니다.")
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "처리에 실패했습니다.")
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size="sm" />
        프로필 변경 요청 확인 중…
      </div>
    )
  }

  if (requests.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-medium">프로필 변경 요청</h2>
        <p className="text-sm text-muted-foreground">
          아이디·반·영어·수학 반 변경 승인 대기 목록입니다.
        </p>
      </div>
      <ul className="space-y-3">
        {requests.map((request) => (
          <li key={request.id}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{request.userName}</CardTitle>
                <CardDescription>
                  {request.currentLoginId}
                  {request.currentClassN ? (
                    <span>
                      {" "}
                      · {classFromNumber(request.currentClassN)?.label ?? `${request.currentClassN}반`}
                    </span>
                  ) : null}
                  {formatUserSchoolLevels({
                    englishLevel: request.currentEnglishLevel,
                    mathLevel: request.currentMathLevel,
                  }) ? (
                    <span>
                      {" "}
                      ·{" "}
                      {formatUserSchoolLevels({
                        englishLevel: request.currentEnglishLevel,
                        mathLevel: request.currentMathLevel,
                      })}
                    </span>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-1 text-sm">
                  {request.requestedLoginId ? (
                    <li>
                      아이디: {request.currentLoginId} → {request.requestedLoginId}
                    </li>
                  ) : null}
                  {request.requestedClassN ? (
                    <li>
                      반:{" "}
                      {request.currentClassN
                        ? classFromNumber(request.currentClassN)?.label ?? `${request.currentClassN}반`
                        : "미정"}{" "}
                      → {classFromNumber(request.requestedClassN)?.label ?? `${request.requestedClassN}반`}
                    </li>
                  ) : null}
                  {request.requestedEnglishLevel ? (
                    <li>
                      영어:{" "}
                      {request.currentEnglishLevel
                        ? formatEnglishLevel(request.currentEnglishLevel)
                        : "미정"}{" "}
                      → {formatEnglishLevel(request.requestedEnglishLevel)}
                    </li>
                  ) : null}
                  {request.requestedMathLevel ? (
                    <li>
                      수학:{" "}
                      {request.currentMathLevel
                        ? formatMathLevel(request.currentMathLevel)
                        : "미정"}{" "}
                      → {formatMathLevel(request.requestedMathLevel)}
                    </li>
                  ) : null}
                </ul>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">전체 글</p>
                  <UserActivityList items={activity[request.userId] ?? []} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={busyId === request.id}
                    onClick={() => void handleAction(request.id, "reject")}
                  >
                    {busyId === request.id ? (
                      <Spinner size="xs" label="처리 중" />
                    ) : (
                      <UserMinus />
                    )}
                    거절
                  </Button>
                  <Button
                    size="sm"
                    disabled={busyId === request.id}
                    onClick={() => void handleAction(request.id, "approve")}
                  >
                    {busyId === request.id ? (
                      <Spinner size="xs" label="처리 중" />
                    ) : (
                      <Check />
                    )}
                    승인
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}
