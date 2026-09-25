"use client"

import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { GroupPerson } from "@/domain/services/class-groups"
import { documentCharCount, MAX_GROUP_DOCUMENTS, UNTITLED_DOCUMENT } from "@/domain/services/group-docs"
import type { useGroupLive } from "@/hooks/use-group-live"
import {
  Bold,
  FileText,
  Heading1,
  Italic,
  List,
  ListOrdered,
  LoaderCircle,
  Plus,
  Trash2,
  Underline,
} from "lucide-react"
import { useRef, type ReactNode } from "react"

function saveLabel(state: "saved" | "saving" | "offline") {
  if (state === "saving") return "저장 중…"
  if (state === "offline") return "오프라인 — 연결 후 저장됩니다"
  return "저장됨"
}

function editedLine(name: string, at: string) {
  if (!name && !at) return "아직 저장된 내용이 없습니다"
  const when = at
    ? new Date(at).toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : ""
  if (name && when) return `마지막 수정 ${name} · ${when}`
  if (when) return `마지막 수정 ${when}`
  return `마지막 수정 ${name}`
}

function wrapSelection(
  area: HTMLTextAreaElement,
  before: string,
  after = before
): { body: string; start: number; end: number } {
  const start = area.selectionStart
  const end = area.selectionEnd
  const value = area.value
  const selected = value.slice(start, end) || "텍스트"
  const next = value.slice(0, start) + before + selected + after + value.slice(end)
  return {
    body: next,
    start: start + before.length,
    end: start + before.length + selected.length,
  }
}

function prefixLines(area: HTMLTextAreaElement, marker: string): { body: string } {
  const start = area.selectionStart
  const end = area.selectionEnd
  const value = area.value
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1
  const chunk = value.slice(lineStart, end)
  const nextChunk = chunk
    .split("\n")
    .map((line) => (line.startsWith(marker) ? line : `${marker}${line || "항목"}`))
    .join("\n")
  return { body: value.slice(0, lineStart) + nextChunk + value.slice(end) }
}

function initial(name: string) {
  return name.trim().slice(0, 1) || "?"
}

export function GroupDocsPanel({
  live,
  people,
}: {
  live: ReturnType<typeof useGroupLive>
  people: GroupPerson[]
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const {
    docs,
    typing,
    active,
    status,
    error,
    saveState,
    canEdit,
    selectDocument,
    patchActive,
    createDocument,
    deleteDocument,
  } = live

  function applyWrap(before: string, after?: string) {
    const area = bodyRef.current
    if (!area || !canEdit) return
    const next = wrapSelection(area, before, after)
    patchActive({ body: next.body })
    requestAnimationFrame(() => {
      area.focus()
      area.setSelectionRange(next.start, next.end)
    })
  }

  function applyPrefix(marker: string) {
    const area = bodyRef.current
    if (!area || !canEdit) return
    const next = prefixLines(area, marker)
    patchActive({ body: next.body })
    requestAnimationFrame(() => area.focus())
  }

  if (status === "forbidden") {
    return (
      <p className="text-sm text-muted-foreground">
        {error ?? "이 조 조원만 공동 문서를 볼 수 있습니다."}
      </p>
    )
  }

  if (status === "missing") {
    return <p className="text-sm text-muted-foreground">{error ?? "조를 찾을 수 없습니다."}</p>
  }

  if (status === "loading" && !docs) {
    return <p className="text-sm text-muted-foreground">문서를 여는 중…</p>
  }

  const papers = docs?.documents ?? []
  const full = papers.length >= MAX_GROUP_DOCUMENTS
  const docsTyping = typing.filter((item) => item.surface === "docs" && item.userId)
  const faces = people.slice(0, 5)

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border bg-card px-3 py-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FileText className="size-5 shrink-0 text-primary" aria-hidden />
          <input
            aria-label="문서 제목"
            className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground"
            value={active?.title === UNTITLED_DOCUMENT ? "" : (active?.title ?? "")}
            placeholder={UNTITLED_DOCUMENT}
            maxLength={120}
            readOnly={!canEdit}
            onChange={(event) => patchActive({ title: event.target.value })}
          />
        </div>
        <div className="flex items-center gap-2">
          {faces.length > 0 ? (
            <AvatarGroup className="pr-1">
              {faces.map((person) => (
                <Avatar key={person.id} size="sm" title={person.name}>
                  <AvatarFallback>{initial(person.name)}</AvatarFallback>
                </Avatar>
              ))}
            </AvatarGroup>
          ) : null}
          <p className="shrink-0 text-xs text-muted-foreground">{saveLabel(saveState)}</p>
        </div>
      </div>

      {papers.length > 1 || canEdit ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-card px-2 py-1.5">
          {papers.map((paper) => (
            <Button
              key={paper.id}
              type="button"
              size="xs"
              variant={paper.id === active?.id ? "secondary" : "ghost"}
              onClick={() => selectDocument(paper.id)}
            >
              {paper.title || UNTITLED_DOCUMENT}
            </Button>
          ))}
          {canEdit ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={full}
              onClick={() => void createDocument()}
            >
              <Plus data-icon="inline-start" />
              문서
            </Button>
          ) : null}
        </div>
      ) : null}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-card px-2 py-1">
          <ToolbarButton label="제목" onClick={() => applyPrefix("# ")}>
            <Heading1 />
          </ToolbarButton>
          <ToolbarButton label="굵게" onClick={() => applyWrap("**")}>
            <Bold />
          </ToolbarButton>
          <ToolbarButton label="기울임" onClick={() => applyWrap("*")}>
            <Italic />
          </ToolbarButton>
          <ToolbarButton label="밑줄" onClick={() => applyWrap("__")}>
            <Underline />
          </ToolbarButton>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <ToolbarButton label="목록" onClick={() => applyPrefix("- ")}>
            <List />
          </ToolbarButton>
          <ToolbarButton label="번호 목록" onClick={() => applyPrefix("1. ")}>
            <ListOrdered />
          </ToolbarButton>
          {papers.length > 1 && active ? (
            <>
              <span className="flex-1" />
              <ToolbarButton label="이 문서 지우기" onClick={() => void deleteDocument(active.id)}>
                <Trash2 />
              </ToolbarButton>
            </>
          ) : null}
        </div>
      ) : null}

      {docsTyping.length > 0 ? (
        <p className="border-b border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          {docsTyping.map((item) => item.name).join(", ")} 편집 중…
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col bg-card px-4 py-3 sm:px-6 sm:py-4">
        <label className="sr-only" htmlFor="group-doc-body">
          문서 본문
        </label>
        <textarea
          id="group-doc-body"
          ref={bodyRef}
          value={active?.body ?? ""}
          readOnly={!canEdit}
          placeholder="여기에 입력하거나 붙여넣으세요"
          onChange={(event) => patchActive({ body: event.target.value })}
          className="min-h-0 w-full flex-1 resize-none bg-transparent text-[17px] leading-7 text-foreground outline-none placeholder:text-muted-foreground/70"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
        <span>글자 {documentCharCount(active?.body ?? "")}</span>
        <span className="inline-flex items-center gap-1">
          {saveState === "saving" ? <LoaderCircle className="size-3 animate-spin" /> : null}
          {editedLine(active?.updatedBy ?? "", active?.updatedAt ?? "")}
        </span>
      </div>
    </div>
  )
}

function ToolbarButton({
  label,
  children,
  onClick,
}: {
  label: string
  children: ReactNode
  onClick: () => void
}) {
  return (
    <Button type="button" variant="ghost" size="icon-xs" aria-label={label} title={label} onClick={onClick}>
      {children}
    </Button>
  )
}
