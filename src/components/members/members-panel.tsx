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
import { UserActivityList } from "@/components/user/user-activity-list"
import { useAuth } from "@/hooks/use-auth"
import type { UserActivityItem } from "@/domain/entities/user"
import {
  accessLevelActionLabel,
  allowedLevelOptions,
  canAssignAdmin,
  canClearUserRecords,
  isWaldoAccount,
  displayAccessLabel,
} from "@/domain/services/access-level"
import { classFromNumber } from "@/shared/classes"
import { formatUserSchoolLevels } from "@/domain/services/school-note-kinds"
import type { AccessLevel, AuthUser } from "@/domain/entities/board"
import { Spinner } from "@/components/ui/spinner"
import { ChevronDown, ChevronUp, Eraser, UserMinus } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

export function MembersPanel({
  actor,
  initialMembers,
  initialActivity,
  initialCanReorder,
}: {
  actor: AuthUser
  initialMembers?: AuthUser[]
  initialActivity?: Record<string, UserActivityItem[]>
  initialCanReorder?: boolean
}) {
  const { refresh } = useAuth()
  const [members, setMembers] = useState<AuthUser[]>(initialMembers ?? [])
  const [activity, setActivity] = useState<Record<string, UserActivityItem[]>>(
    initialActivity ?? {}
  )
  const [loading, setLoading] = useState(!initialMembers)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [activityVisible, setActivityVisible] = useState<Record<string, boolean>>({})
  const [canReorder, setCanReorder] = useState(Boolean(initialCanReorder))
  const [restoring, setRestoring] = useState(false)
  const [purging, setPurging] = useState(false)
  const isOwner = canAssignAdmin(actor)
  const canClearRecords = canClearUserRecords(actor)

  function toggleActivityVisibility(userId: string) {
    setActivityVisible((current) => ({
      ...current,
      [userId]: !(current[userId] ?? true),
    }))
  }

  function showAllActivity() {
    setActivityVisible(Object.fromEntries(members.map((member) => [member.id, true])))
  }

  function hideAllActivity() {
    setActivityVisible(Object.fromEntries(members.map((member) => [member.id, false])))
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const response = await fetch("/api/auth/members", {
        cache: "no-store",
        credentials: "same-origin",
      })
      const payload = (await response.json()) as {
        members?: AuthUser[]
        activity?: Record<string, UserActivityItem[]>
        canReorder?: boolean
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "회원 목록을 불러오지 못했습니다.")
      }
      setMembers(payload.members ?? [])
      setActivity(payload.activity ?? {})
      setCanReorder(Boolean(payload.canReorder))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "목록을 불러오지 못했습니다."
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(initialMembers !== undefined)
  }, [load, actor.id])

  async function restoreMembers() {
    setRestoring(true)
    try {
      const response = await fetch("/api/auth/members/restore", {
        method: "POST",
        credentials: "same-origin",
      })
      const payload = (await response.json()) as {
        beforeCount?: number
        afterCount?: number
        restored?: Array<{ name: string; loginId: string }>
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "회원을 복구하지 못했습니다.")
      }
      const names = (payload.restored ?? []).map((member) => member.name)
      if (names.length > 0) {
        toast.success(`${names.join(", ")} 회원을 복구했습니다.`)
      } else if ((payload.afterCount ?? 0) > (payload.beforeCount ?? 0)) {
        toast.success("회원 목록을 복구했습니다.")
      } else {
        toast.message("추가로 찾을 수 있는 회원 기록이 없습니다.")
      }
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "복구에 실패했습니다.")
    } finally {
      setRestoring(false)
    }
  }

  async function purgeNonWaldo() {
    if (
      !window.confirm(
        "Waldo를 제외한 모든 회원을 퇴출하고, 모든 반의 할 일을 지울까요? 아이디가 정확히 Waldo인 소유자만 남습니다. Waldo2는 보호되지 않습니다."
      )
    ) {
      return
    }
    setPurging(true)
    try {
      const response = await fetch("/api/auth/purge-non-waldo", {
        method: "POST",
        credentials: "same-origin",
      })
      const payload = (await response.json()) as {
        removed?: Array<{ name: string; loginId: string }>
        tasksCleared?: number
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "일괄 정리에 실패했습니다.")
      }
      const names = (payload.removed ?? []).map((member) => member.name)
      const tasks = payload.tasksCleared ?? 0
      if (names.length === 0 && tasks === 0) {
        toast.message("지울 회원이나 할 일이 없습니다.")
      } else {
        const parts = [
          names.length > 0 ? `${names.join(", ")} 퇴출` : null,
          tasks > 0 ? `할 일 ${tasks}개 삭제` : null,
        ].filter(Boolean)
        toast.success(`${parts.join(", ")}했습니다.`)
      }
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "일괄 정리에 실패했습니다.")
    } finally {
      setPurging(false)
    }
  }

  async function removeMember(userId: string, name: string) {
    if (!window.confirm(`${name} 회원을 퇴출시키겠습니까? 계정이 삭제됩니다.`)) {
      return
    }
    setBusyId(userId)
    try {
      const response = await fetch("/api/auth/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "퇴출에 실패했습니다.")
      }
      toast.success(`${name} 회원을 퇴출시켰습니다.`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "퇴출에 실패했습니다.")
    } finally {
      setBusyId(null)
    }
  }

  async function clearRecords(userId: string, name: string) {
    if (
      !window.confirm(
        `${name} 님의 소식, 댓글, 본인이 만든 할 일, 노트·할 일 수정 기록을 전부 삭제할까요? 계정은 그대로 둡니다.`
      )
    ) {
      return
    }
    setBusyId(userId)
    try {
      const response = await fetch("/api/auth/clear-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "기록 삭제에 실패했습니다.")
      }
      toast.success(`${name} 님의 기록을 삭제했습니다.`)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "기록 삭제에 실패했습니다.")
    } finally {
      setBusyId(null)
    }
  }

  async function approveHold(userId: string, name: string) {
    setBusyId(userId)
    try {
      const response = await fetch("/api/auth/content-hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "허가에 실패했습니다.")
      }
      toast.success(`${name} 회원의 작성을 다시 허가했습니다.`)
      await load()
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "허가에 실패했습니다.")
    } finally {
      setBusyId(null)
    }
  }

  async function changeLevel(userId: string, accessLevel: AccessLevel) {
    setBusyId(userId)
    try {
      const response = await fetch("/api/auth/access-level", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId, accessLevel }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "등급 변경에 실패했습니다.")
      }
      toast.success("회원 등급을 변경했습니다.")
      await load()
      await refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "등급 변경에 실패했습니다."
      )
    } finally {
      setBusyId(null)
    }
  }

  async function moveMember(userId: string, direction: "up" | "down") {
    setBusyId(userId)
    try {
      const response = await fetch("/api/auth/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ userId, direction }),
      })
      const payload = (await response.json()) as {
        members?: AuthUser[]
        error?: string
      }
      if (!response.ok || !payload.members) {
        throw new Error(payload.error ?? "순서 변경에 실패했습니다.")
      }
      setMembers(payload.members)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "순서 변경에 실패했습니다.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">
          회원 목록
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {isOwner
            ? "관리자 지정, 등급 변경, 기록 삭제, 퇴출을 할 수 있습니다. 소유자만 Waldo 외 회원을 한 번에 지우고 모든 반 할 일을 비울 수 있습니다."
            : "뷰어·작성자 등급을 변경하고, 글·수정 기록을 삭제할 수 있습니다."}
          {canReorder ? " 회원 순서 변경 가능." : null}
          {" "}
          욕설·음란 표현으로 강등된 회원은 맨 위에 보이며, 허가할 때까지 뷰어로 유지됩니다.
          계정과 계정 정보는 배포가 바뀌어도 계정별 저장소에 남습니다. 퇴출한 계정만 지워집니다.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {!loading && members.length > 0 ? (
            <>
              <Button type="button" size="sm" variant="outline" onClick={showAllActivity}>
                전부 보이기
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={hideAllActivity}>
                전부 숨기기
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void restoreMembers()}
            disabled={restoring || purging || loading}
          >
            {restoring ? "복구 중…" : "사라진 회원 복구"}
          </Button>
          {isOwner ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => void purgeNonWaldo()}
              disabled={restoring || purging || loading}
            >
              {purging ? "정리 중…" : "Waldo 외 회원·할 일 비우기"}
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size="sm" />
          회원 목록 불러오는 중…
        </div>
      ) : (
        <ul className="space-y-3">
          {members.map((member, index) => {
            const options = allowedLevelOptions(actor, member)
            const locked = isWaldoAccount(member.loginId) || options.length === 0
            const showActivity = activityVisible[member.id] ?? true
            const hold = member.contentHold

            return (
              <li key={member.id}>
                <Card className={hold ? "border-destructive/40" : undefined}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{member.name}</CardTitle>
                        <CardDescription>
                          {member.loginId}
                          {member.classN ? (
                            <span>
                              {" "}
                              · {classFromNumber(member.classN)?.label ?? `${member.classN}반`}
                            </span>
                          ) : null}
                          {formatUserSchoolLevels(member) ? (
                            <span> · {formatUserSchoolLevels(member)}</span>
                          ) : null}
                        </CardDescription>
                      </div>
                      {canReorder ? (
                        <div className="flex shrink-0 flex-col gap-1">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            aria-label={`${member.name} 위로`}
                            disabled={busyId === member.id || index === 0}
                            onClick={() => void moveMember(member.id, "up")}
                          >
                            <ChevronUp />
                          </Button>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            aria-label={`${member.name} 아래로`}
                            disabled={busyId === member.id || index === members.length - 1}
                            onClick={() => void moveMember(member.id, "down")}
                          >
                            <ChevronDown />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {hold ? (
                      <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                        <p className="text-sm font-medium text-destructive">내용 심사 대기</p>
                        <p className="text-xs leading-5 text-muted-foreground">
                          부적절한 표현이 감지되어 해당 내용은 저장되지 않았고, 뷰어로
                          조정되었습니다. 허가하면 이전 등급으로 돌아갑니다.
                        </p>
                        {hold.snippet ? (
                          <p className="text-xs text-muted-foreground">
                            감지된 내용: {hold.snippet}
                          </p>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === member.id}
                          onClick={() => void approveHold(member.id, member.name)}
                        >
                          {busyId === member.id ? (
                            <Spinner size="xs" label="처리 중" />
                          ) : null}
                          작성 허가
                        </Button>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        현재: {displayAccessLabel(member)}
                      </span>
                      {locked ? (
                        <span className="rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                          {isWaldoAccount(member.loginId)
                            ? "소유자 (변경 불가)"
                            : "관리자 (소유자만 변경)"}
                        </span>
                      ) : (
                        options.map((level) => (
                          <Button
                            key={level}
                            size="sm"
                            variant={
                              member.accessLevel === level ? "default" : "outline"
                            }
                            disabled={busyId === member.id}
                            onClick={() => void changeLevel(member.id, level)}
                          >
                            {busyId === member.id ? (
                              <Spinner size="xs" label="처리 중" />
                            ) : null}
                            {accessLevelActionLabel(level)}로
                          </Button>
                        ))
                      )}
                    </div>
                    {canClearRecords || isOwner ? (
                      <div className="flex flex-wrap gap-2">
                        {canClearRecords ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-fit text-destructive hover:text-destructive"
                            disabled={busyId === member.id}
                            onClick={() => void clearRecords(member.id, member.name)}
                          >
                            {busyId === member.id ? (
                              <Spinner size="xs" label="처리 중" />
                            ) : (
                              <Eraser />
                            )}
                            기록 전부 삭제
                          </Button>
                        ) : null}
                        {isOwner && !isWaldoAccount(member.loginId) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-fit text-destructive hover:text-destructive"
                            disabled={busyId === member.id}
                            onClick={() => void removeMember(member.id, member.name)}
                          >
                            {busyId === member.id ? (
                              <Spinner size="xs" label="처리 중" />
                            ) : (
                              <UserMinus />
                            )}
                            퇴출
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="space-y-1.5 border-t border-border/60 pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-muted-foreground">전체 글</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => toggleActivityVisibility(member.id)}
                        >
                          {showActivity ? "숨기기" : "보이기"}
                        </Button>
                      </div>
                      {showActivity ? (
                        <UserActivityList items={activity[member.id] ?? []} />
                      ) : (
                        <p className="text-xs leading-5 text-muted-foreground">
                          글 목록을 숨겼어요.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href="/approve" variant="outline">
          회원 승인
        </ButtonLink>
        <ButtonLink href="/" variant="ghost">
          ← 홈
        </ButtonLink>
      </div>
    </div>
  )
}
