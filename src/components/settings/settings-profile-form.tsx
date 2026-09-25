"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import {
  canDirectProfileChange,
  isWaldoAccount,
} from "@/domain/services/access-level"
import type { ClassNumber, ProfileChangeRequest, SchoolLevel } from "@/domain/entities/user"
import { HOMEROOM_CLASSES } from "@/shared/classes"
import {
  formatEnglishLevel,
  formatMathLevel,
  SCHOOL_LEVEL_LABELS,
  SCHOOL_NOTE_LEVELS,
} from "@/domain/services/school-note-kinds"
import type { AuthUser } from "@/domain/entities/board"
import { Spinner } from "@/components/ui/spinner"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

function SchoolLevelPicker({
  legend,
  name,
  value,
  disabled,
  onChange,
}: {
  legend: string
  name: string
  value: SchoolLevel | null
  disabled?: boolean
  onChange: (level: SchoolLevel) => void
}) {
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {SCHOOL_NOTE_LEVELS.map((level) => {
          const selected = value === level
          return (
            <label
              key={`${name}-${level}`}
              className={
                selected
                  ? "flex cursor-pointer items-center justify-center rounded-md border border-primary bg-muted px-2 py-2 text-sm font-medium"
                  : "flex cursor-pointer items-center justify-center rounded-md border border-border bg-card px-2 py-2 text-sm hover:bg-muted"
              }
            >
              <input
                type="radio"
                name={name}
                value={level}
                checked={selected}
                onChange={() => onChange(level)}
                className="sr-only"
              />
              {SCHOOL_LEVEL_LABELS[level]}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export function SettingsProfileForm({ user }: { user: AuthUser }) {
  const { refresh } = useAuth()
  const direct = canDirectProfileChange(user)
  const waldoLocked = isWaldoAccount(user.loginId)

  const [savedLoginId, setSavedLoginId] = useState(user.loginId)
  const [savedClassN, setSavedClassN] = useState<ClassNumber | null>(user.classN ?? null)
  const [savedEnglishLevel, setSavedEnglishLevel] = useState<SchoolLevel | null>(
    user.englishLevel ?? null
  )
  const [savedMathLevel, setSavedMathLevel] = useState<SchoolLevel | null>(
    user.mathLevel ?? null
  )
  const [loginId, setLoginId] = useState(user.loginId)
  const [classN, setClassN] = useState<ClassNumber | null>(user.classN ?? null)
  const [englishLevel, setEnglishLevel] = useState<SchoolLevel | null>(
    user.englishLevel ?? null
  )
  const [mathLevel, setMathLevel] = useState<SchoolLevel | null>(user.mathLevel ?? null)
  const [pendingRequest, setPendingRequest] =
    useState<ProfileChangeRequest | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadPending = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/profile", {
        cache: "no-store",
        credentials: "same-origin",
      })
      const payload = (await response.json()) as {
        pendingRequest?: ProfileChangeRequest | null
      }
      if (response.ok) {
        setPendingRequest(payload.pendingRequest ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Pick up the account's new values after a save or refresh, without an extra effect pass.
  const userKey = [user.id, user.loginId, user.classN, user.englishLevel, user.mathLevel].join("|")
  const [syncedUserKey, setSyncedUserKey] = useState(userKey)
  if (syncedUserKey !== userKey) {
    setSyncedUserKey(userKey)
    setSavedLoginId(user.loginId)
    setSavedClassN(user.classN ?? null)
    setSavedEnglishLevel(user.englishLevel ?? null)
    setSavedMathLevel(user.mathLevel ?? null)
    setLoginId(user.loginId)
    setClassN(user.classN ?? null)
    setEnglishLevel(user.englishLevel ?? null)
    setMathLevel(user.mathLevel ?? null)
  }

  useEffect(() => {
    void loadPending()
  }, [loadPending, userKey])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pendingRequest && !direct) {
      toast.message("승인 대기 중인 변경 요청이 있습니다.")
      return
    }
    if (!classN) {
      toast.error("반을 선택해 주세요.")
      return
    }
    if (!englishLevel) {
      toast.error("영어 반을 선택해 주세요.")
      return
    }
    if (!mathLevel) {
      toast.error("수학 반을 선택해 주세요.")
      return
    }

    setBusy(true)
    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          loginId: waldoLocked ? undefined : loginId.trim(),
          classN,
          englishLevel,
          mathLevel,
        }),
      })
      const payload = (await response.json()) as {
        user?: AuthUser
        pendingRequest?: ProfileChangeRequest
        direct?: boolean
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "변경에 실패했습니다.")
      }

      if (payload.direct && payload.user) {
        toast.success("프로필을 변경했습니다.")
        setSavedLoginId(payload.user.loginId)
        setSavedClassN(payload.user.classN ?? null)
        setSavedEnglishLevel(payload.user.englishLevel ?? null)
        setSavedMathLevel(payload.user.mathLevel ?? null)
        setLoginId(payload.user.loginId)
        setClassN(payload.user.classN ?? null)
        setEnglishLevel(payload.user.englishLevel ?? null)
        setMathLevel(payload.user.mathLevel ?? null)
        setPendingRequest(null)
        await refresh()
      } else if (payload.pendingRequest) {
        toast.success("변경 요청을 보냈습니다.")
        setPendingRequest(payload.pendingRequest)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "변경에 실패했습니다.")
    } finally {
      setBusy(false)
    }
  }

  const unchanged =
    loginId.trim() === savedLoginId &&
    classN === savedClassN &&
    englishLevel === savedEnglishLevel &&
    mathLevel === savedMathLevel

  const formDisabled = Boolean(pendingRequest && !direct)

  return (
    <form noValidate onSubmit={submit} className="space-y-4 border-t border-border/60 pt-4">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">아이디 · 반 · 영어·수학 반 변경</h2>
        <p className="text-xs leading-5 text-muted-foreground">
          {direct
            ? "관리자·소유자는 즉시 변경할 수 있습니다."
            : "일반 회원은 관리자·소유자 승인 후 반영됩니다."}
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">요청 상태 확인 중…</p>
      ) : pendingRequest ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
          승인 대기 중:
          {pendingRequest.requestedLoginId ? (
            <span className="ml-1">
              아이디 → {pendingRequest.requestedLoginId}
            </span>
          ) : null}
          {pendingRequest.requestedClassN ? (
            <span className="ml-1">
              반 → {pendingRequest.requestedClassN}반
            </span>
          ) : null}
          {pendingRequest.requestedEnglishLevel ? (
            <span className="ml-1">
              영어 → {formatEnglishLevel(pendingRequest.requestedEnglishLevel)}
            </span>
          ) : null}
          {pendingRequest.requestedMathLevel ? (
            <span className="ml-1">
              수학 → {formatMathLevel(pendingRequest.requestedMathLevel)}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="settings-login-id">아이디</Label>
        <Input
          id="settings-login-id"
          value={loginId}
          disabled={waldoLocked || formDisabled}
          onChange={(event) => setLoginId(event.target.value)}
          autoComplete="off"
          placeholder="3~20자"
        />
        {waldoLocked ? (
          <p className="text-xs text-muted-foreground">
            Waldo 소유자 아이디는 변경할 수 없습니다.
          </p>
        ) : null}
      </div>

      <fieldset className="grid gap-2" disabled={formDisabled}>
        <legend className="text-sm font-medium">반</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HOMEROOM_CLASSES.map((item) => {
            const selected = classN === item.n
            return (
              <label
                key={item.n}
                className={
                  selected
                    ? "flex cursor-pointer items-center justify-center rounded-md border border-primary bg-muted px-3 py-2 text-sm font-medium"
                    : "flex cursor-pointer items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
                }
              >
                <input
                  type="radio"
                  name="settings-class"
                  value={item.n}
                  checked={selected}
                  onChange={() => setClassN(item.n)}
                  className="sr-only"
                />
                {item.label}
              </label>
            )
          })}
        </div>
      </fieldset>

      <SchoolLevelPicker
        legend="영어 반"
        name="settings-english"
        value={englishLevel}
        disabled={formDisabled}
        onChange={setEnglishLevel}
      />

      <SchoolLevelPicker
        legend="수학 반"
        name="settings-math"
        value={mathLevel}
        disabled={formDisabled}
        onChange={setMathLevel}
      />

      <Button
        type="submit"
        className="w-full"
        disabled={
          busy ||
          unchanged ||
          !classN ||
          !englishLevel ||
          !mathLevel ||
          formDisabled
        }
      >
        {busy ? <Spinner size="xs" label="저장 중" /> : null}
        {direct ? "변경 저장" : "승인 요청"}
      </Button>
    </form>
  )
}
