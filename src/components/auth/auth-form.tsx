"use client"

import { CommunityPolicyNotice } from "@/components/policy/community-policy-notice"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import type { SchoolLevel } from "@/domain/entities/user"
import { HOMEROOM_CLASSES } from "@/shared/classes"
import {
  SCHOOL_LEVEL_LABELS,
  SCHOOL_NOTE_LEVELS,
} from "@/domain/services/school-note-kinds"
import type { AuthUser } from "@/domain/entities/board"
import { Spinner } from "@/components/ui/spinner"
import { type FormEvent, useState } from "react"
import { toast } from "sonner"

export type AuthMode = "login" | "signup"

export function AuthForm({
  mode,
  onModeChange,
  onSuccess,
  compact = false,
}: {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  onSuccess?: (user: AuthUser) => void
  compact?: boolean
}) {
  const { login, signup } = useAuth()
  const [loginId, setLoginId] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [classN, setClassN] = useState<number | null>(null)
  const [englishLevel, setEnglishLevel] = useState<SchoolLevel | null>(null)
  const [mathLevel, setMathLevel] = useState<SchoolLevel | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const needsFirstMember = false

  // Switching login/signup clears the confirm field and any stale error.
  const [formMode, setFormMode] = useState(mode)
  if (formMode !== mode) {
    setFormMode(mode)
    setPasswordConfirm("")
    setFormError(null)
  }

  const confirmMismatch =
    mode === "signup" && passwordConfirm.length > 0 && password !== passwordConfirm
  const confirmMatch =
    mode === "signup" && passwordConfirm.length > 0 && password === passwordConfirm

  function clearError() {
    setFormError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearError()

    const formData = new FormData(event.currentTarget)
    const submittedPassword = String(formData.get("password") ?? password)
    const submittedConfirm = String(formData.get("passwordConfirm") ?? passwordConfirm)
    if (submittedPassword !== password) setPassword(submittedPassword)
    if (submittedConfirm !== passwordConfirm) setPasswordConfirm(submittedConfirm)

    const trimmedLoginId = loginId.trim()
    const trimmedName = name.trim()

    if (!trimmedLoginId) {
      setFormError("아이디를 입력해 주세요.")
      return
    }
    if (!submittedPassword) {
      setFormError("비밀번호를 입력해 주세요.")
      return
    }
    if (mode === "signup" && !trimmedName) {
      setFormError("이름을 입력해 주세요.")
      return
    }
    if (mode === "signup" && !submittedConfirm) {
      setFormError("비밀번호 확인을 입력해 주세요.")
      return
    }
    if (mode === "signup" && submittedPassword !== submittedConfirm) {
      setFormError("비밀번호가 일치하지 않습니다.")
      return
    }
    if (mode === "signup" && !classN) {
      setFormError("반을 선택해 주세요.")
      return
    }
    if (mode === "signup" && !englishLevel) {
      setFormError("영어 반을 선택해 주세요.")
      return
    }
    if (mode === "signup" && !mathLevel) {
      setFormError("수학 반을 선택해 주세요.")
      return
    }

    setBusy(true)
    try {
      const user =
        mode === "login"
          ? await login(trimmedLoginId, submittedPassword)
          : await signup(
              trimmedLoginId,
              trimmedName,
              submittedPassword,
              submittedConfirm,
              classN ?? undefined,
              englishLevel ?? undefined,
              mathLevel ?? undefined
            )

      if (user.status === "pending") {
        toast.success("가입 신청을 접수했습니다.")
      } else if (mode === "login") {
        toast.success("로그인했습니다.")
      } else {
        toast.success("가입이 완료되었습니다.")
      }

      setPassword("")
      setPasswordConfirm("")
      onSuccess?.(user)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "요청에 실패했습니다."
      setFormError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      {formError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor={`${mode}-login-id`}>아이디</Label>
        <Input
          id={`${mode}-login-id`}
          autoComplete="off"
          placeholder="3~20자"
          value={loginId}
          onChange={(event) => {
            clearError()
            setLoginId(event.target.value)
          }}
          aria-invalid={formError ? true : undefined}
        />
      </div>
      {mode === "signup" ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`${mode}-name`}>이름 (실명)</Label>
          <Input
            id={`${mode}-name`}
            autoComplete="off"
            value={name}
            onChange={(event) => {
              clearError()
              setName(event.target.value)
            }}
            aria-invalid={formError ? true : undefined}
          />
          {needsFirstMember ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
              첫 가입자는 승인 없이 이용할 수 있습니다.
            </p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              가입 후 관리자 승인이 필요합니다. 승인 시 기본 등급은 작성자입니다.
            </p>
          )}
        </div>
      ) : null}
      {mode === "signup" ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">반 선택</legend>
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
                    name={`${mode}-class`}
                    value={item.n}
                    checked={selected}
                    onChange={() => {
                      clearError()
                      setClassN(item.n)
                    }}
                    className="sr-only"
                  />
                  {item.label}
                </label>
              )
            })}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            선택한 반만 수정할 수 있습니다. 다른 반은 열람만 가능합니다.
          </p>
        </fieldset>
      ) : null}
      {mode === "signup" ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">영어 반</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {SCHOOL_NOTE_LEVELS.map((level) => {
              const selected = englishLevel === level
              return (
                <label
                  key={`english-${level}`}
                  className={
                    selected
                      ? "flex cursor-pointer items-center justify-center rounded-md border border-primary bg-muted px-2 py-2 text-sm font-medium"
                      : "flex cursor-pointer items-center justify-center rounded-md border border-border bg-card px-2 py-2 text-sm hover:bg-muted"
                  }
                >
                  <input
                    type="radio"
                    name={`${mode}-english`}
                    value={level}
                    checked={selected}
                    onChange={() => {
                      clearError()
                      setEnglishLevel(level)
                    }}
                    className="sr-only"
                  />
                  {SCHOOL_LEVEL_LABELS[level]}
                </label>
              )
            })}
          </div>
        </fieldset>
      ) : null}
      {mode === "signup" ? (
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">수학 반</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {SCHOOL_NOTE_LEVELS.map((level) => {
              const selected = mathLevel === level
              return (
                <label
                  key={`math-${level}`}
                  className={
                    selected
                      ? "flex cursor-pointer items-center justify-center rounded-md border border-primary bg-muted px-2 py-2 text-sm font-medium"
                      : "flex cursor-pointer items-center justify-center rounded-md border border-border bg-card px-2 py-2 text-sm hover:bg-muted"
                  }
                >
                  <input
                    type="radio"
                    name={`${mode}-math`}
                    value={level}
                    checked={selected}
                    onChange={() => {
                      clearError()
                      setMathLevel(level)
                    }}
                    className="sr-only"
                  />
                  {SCHOOL_LEVEL_LABELS[level]}
                </label>
              )
            })}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            전교 영어·수학 메모는 모두 열람할 수 있습니다. 가입 시 선택한 반만 수정할 수
            있습니다.
          </p>
        </fieldset>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor={`${mode}-password`}>비밀번호</Label>
        <Input
          id={`${mode}-password`}
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder="6자 이상"
          value={password}
          onChange={(event) => {
            clearError()
            setPassword(event.target.value)
          }}
          onKeyDown={(event) => {
            if (mode !== "signup" || event.key !== "Enter") return
            event.preventDefault()
            document.getElementById(`${mode}-password-confirm`)?.focus()
          }}
          aria-invalid={formError?.includes("비밀번호") ? true : undefined}
        />
      </div>
      {mode === "signup" ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`${mode}-password-confirm`}>비밀번호 확인</Label>
          <Input
            id={`${mode}-password-confirm`}
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            placeholder="비밀번호를 한 번 더 입력"
            value={passwordConfirm}
            onChange={(event) => {
              clearError()
              setPasswordConfirm(event.target.value)
            }}
            aria-invalid={confirmMismatch || formError?.includes("비밀번호") ? true : undefined}
            aria-describedby={
              confirmMismatch || confirmMatch ? `${mode}-password-confirm-hint` : undefined
            }
          />
          {confirmMismatch ? (
            <p
              id={`${mode}-password-confirm-hint`}
              className="text-xs leading-5 text-destructive"
            >
              비밀번호가 일치하지 않습니다.
            </p>
          ) : confirmMatch ? (
            <p
              id={`${mode}-password-confirm-hint`}
              className="text-xs leading-5 text-muted-foreground"
            >
              비밀번호가 일치합니다.
            </p>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              방금 입력한 비밀번호를 그대로 한 번 더 입력해 주세요.
            </p>
          )}
        </div>
      ) : null}
      {mode === "signup" ? <CommunityPolicyNotice variant="signup" /> : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? <Spinner size="xs" label="처리 중" /> : null}
        {mode === "login" ? "로그인" : "가입 신청"}
      </Button>
      {!compact ? (
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            clearError()
            onModeChange(mode === "login" ? "signup" : "login")
          }}
        >
          {mode === "login" ? "계정이 없나요? 회원가입" : "이미 계정이 있나요? 로그인"}
        </Button>
      ) : null}
    </form>
  )
}
