"use client"

import { ClassSwitcher } from "@/components/layout/class-switcher"
import { Button } from "@/components/ui/button"
import { ButtonLink } from "@/components/ui/button-link"
import { Card, CardContent } from "@/components/ui/card"
import { getNotesBoardView } from "@/application/notes-board"
import { GroupsPanel } from "@/components/room/groups-panel"
import { NotesPanel } from "@/components/room/notes-panel"
import { TaskBoard } from "@/components/room/task-board"
import { UpdatesPanel } from "@/components/room/updates-panel"
import { useAuth } from "@/hooks/use-auth"
import {
  canEditBoard,
  isSiteAdmin,
  isWaldoOwner,
} from "@/domain/services/access-level"
import { useRoom } from "@/hooks/use-room"
import { useSchoolNotes } from "@/hooks/use-school-notes"
import { classFromCode, isLevelClass } from "@/shared/classes"
import {
  normalizeSubjectNotes,
  syncLegacyNotesField,
} from "@/domain/services/subject-notes"
import {
  BOARD_TABS,
  boardTabHref,
  type BoardTab,
} from "@/domain/services/board-tabs"
import { createId } from "@/shared/ids"
import type { ClassGroup, Room, SubjectNoteKind, Task, TaskComment } from "@/domain/entities/board"
import type { GroupPerson } from "@/domain/services/class-groups"
import { PageLoading } from "@/components/layout/page-loading"
import { ArrowLeft, RefreshCw, TriangleAlert, WifiOff } from "lucide-react"
import Link from "next/link"
import { useCallback } from "react"
import { toast } from "sonner"

export function RoomBoard({
  classN,
  code,
  initialRoom = null,
  initialRoster = [],
  activeTab,
}: {
  classN: number
  code: string
  initialRoom?: Room | null
  initialRoster?: GroupPerson[]
  activeTab: BoardTab
}) {
  const cls = classFromCode(code)
  const levelBoard = cls ? isLevelClass(cls) : false
  const notesBoard = getNotesBoardView(code)
  const { user } = useAuth()
  const canEditSite = user ? canEditBoard(user) : false
  const {
    room,
    status,
    saveState,
    error,
    updateRoom,
    postUpdate,
    removeUpdate,
    canEdit,
    canAccessFeed,
    canPostUpdates,
  } = useRoom(code, user, initialRoom)
  const {
    schoolNotes,
    saveState: schoolSaveState,
    canEditSchoolNotes,
    canEditSchoolNote,
    updateSchoolSubjectNote,
  } = useSchoolNotes(user, {
    enabled: activeTab === "notes" && notesBoard.scope === "school",
  })
  const boardTitle = `${cls?.label ?? `${classN}반`} 수행평가`
  const combinedSaveState =
    notesBoard.scope === "class"
      ? saveState
      : saveState === "offline" || schoolSaveState === "offline"
        ? "offline"
        : saveState === "saving" || schoolSaveState === "saving"
          ? "saving"
          : "saved"
  const showNotesSaveStatus =
    notesBoard.scope === "school" ? canEditSchoolNotes : canEdit

  const addTask = useCallback(
    (title: string, dueDate?: string) => {
      if (!canEdit) {
        toast.message("할 일을 추가할 수 있는 권한이 없습니다.")
        return false
      }
      updateRoom((current) => {
        const task: Task = {
          id: createId("task"),
          title,
          notes: "",
          dueDate: dueDate ?? "",
          assigneeIds: user ? [user.id] : [],
          createdAt: new Date().toISOString(),
          comments: [],
        }
        return { ...current, tasks: [task, ...current.tasks] }
      })
      return true
    },
    [canEdit, updateRoom, user]
  )

  const patchTask = useCallback(
    (taskId: string, patch: Partial<Task>) => {
      if (!canEdit) return
      const textField = Object.keys(patch).length === 1 && "notes" in patch
      updateRoom(
        (current) => ({
          ...current,
          tasks: current.tasks.map((task) =>
            task.id === taskId ? { ...task, ...patch } : task
          ),
        }),
        { textField }
      )
    },
    [canEdit, updateRoom]
  )

  const patchGroups = useCallback(
    (groups: ClassGroup[]) => {
      if (!canEdit) return
      updateRoom((current) => ({ ...current, groups }))
    },
    [canEdit, updateRoom]
  )

  const removeTask = useCallback(
    (taskId: string) => {
      if (!canEdit) return
      updateRoom((current) => ({
        ...current,
        tasks: current.tasks.filter((item) => item.id !== taskId),
      }))
    },
    [canEdit, updateRoom]
  )

  const addComment = useCallback(
    (taskId: string, text: string) => {
      if (!canEdit || !user) return
      updateRoom((current) => ({
        ...current,
        tasks: current.tasks.map((task) => {
          if (task.id !== taskId) return task
          const comment: TaskComment = {
            id: createId("cmt"),
            authorId: user.id,
            author: user.name,
            text,
            createdAt: new Date().toISOString(),
          }
          return { ...task, comments: [...(task.comments ?? []), comment] }
        }),
      }))
    },
    [canEdit, updateRoom, user]
  )

  const removeComment = useCallback(
    (taskId: string, commentId: string) => {
      if (!canEdit || !user) return
      updateRoom((current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                comments: (task.comments ?? []).filter(
                  (comment) => comment.id !== commentId
                ),
              }
            : task
        ),
      }))
    },
    [canEdit, updateRoom, user]
  )

  const handleClassNotesChange = useCallback(
    (kind: SubjectNoteKind, value: string) => {
      if (!canEdit) return
      updateRoom(
        (current) => {
          const subjectNotes = normalizeSubjectNotes(current.subjectNotes, current.notes)
          const nextNotes = { ...subjectNotes, [kind]: value }
          return { ...current, ...syncLegacyNotesField(nextNotes) }
        },
        { textField: true }
      )
    },
    [canEdit, updateRoom]
  )

  if (status === "loading") {
    return <PageLoading />
  }

  if (status === "missing") {
    return (
      <CenteredState
        icon={<TriangleAlert className="size-6 text-primary" />}
        title="보드를 찾을 수 없습니다"
        body="반 목록에서 다시 선택해 주세요."
        action={
          <ButtonLink href="/">반 목록</ButtonLink>
        }
      />
    )
  }

  if (status === "error" || !room) {
    return (
      <CenteredState
        icon={<WifiOff className="size-6 text-primary" />}
        title="연결 실패"
        body={error ?? "새로고침 후 다시 시도해 주세요."}
        action={
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw />
            다시 시도
          </Button>
        }
      />
    )
  }

  const isViewer =
    user?.status === "approved" &&
    !canEdit &&
    !canEditSite &&
    !isSiteAdmin(user) &&
    !isWaldoOwner(user)
  const isCrossClassViewer =
    user?.status === "approved" &&
    Boolean(room) &&
    !canEdit &&
    canEditSite &&
    !isSiteAdmin(user) &&
    !isWaldoOwner(user)
  const canModerateComments = user ? isSiteAdmin(user) : false

  return (
    <div
      className={
        activeTab === "groups"
          ? "mx-auto flex min-h-[calc(100dvh-3.25rem)] w-full max-w-none flex-1 flex-col gap-3 px-3 py-3 sm:px-4"
          : "mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6"
      }
    >
      {isViewer ? (
        <p className="border-l-2 border-primary pl-3 text-sm leading-6 text-muted-foreground">
          보기 전용입니다. 할 일·노트·댓글은 수정할 수 없습니다.
        </p>
      ) : null}
      {isCrossClassViewer ? (
        <p className="border-l-2 border-primary pl-3 text-sm leading-6 text-muted-foreground">
          다른 반 보드는 열람만 가능합니다. 수정은 내 반에서만 할 수 있습니다.
        </p>
      ) : null}
      {activeTab === "groups" ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href={`/?tab=${activeTab}`}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              모든 반
            </Link>
            <h1 className="truncate text-base font-semibold">{boardTitle}</h1>
          </div>
          <ClassSwitcher activeCode={room.code} activeTab={activeTab} />
        </div>
      ) : (
        <Card className="gap-4 py-4 sm:py-5">
          <CardContent className="flex flex-col gap-4 px-4 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <Link
              href={activeTab === "tasks" ? "/" : `/?tab=${activeTab}`}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              모든 반
            </Link>
            <ClassSwitcher activeCode={room.code} activeTab={activeTab} />
          </div>
          <div className="space-y-2">
            {room.subject ? (
              <p className="text-sm text-muted-foreground">{room.subject}</p>
            ) : null}
            <h1 className="text-lg font-semibold sm:text-xl">{boardTitle}</h1>
            {room.description ? (
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {room.description}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {room.deadline
                ? `제출 마감 ${formatDeadline(room.deadline)}`
                : "마감일 미정"}
              <span className="mx-2">·</span>
              {room.members.length}명 참여
            </p>
          </div>
          </CardContent>
        </Card>
      )}

      <div
        className={
          activeTab === "groups"
            ? "flex min-h-0 flex-1 flex-col gap-3"
            : "space-y-4"
        }
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <nav
            aria-label="반 보드 메뉴"
            className="flex flex-wrap gap-4 border-b border-border"
          >
          {BOARD_TABS.map((item) => {
            const active = activeTab === item.id
            return (
              <Link
                key={item.id}
                href={boardTabHref(cls?.slug ?? classN, item.id)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "-mb-px border-b-2 border-primary pb-2 text-sm font-medium text-primary"
                    : "pb-2 text-sm text-muted-foreground hover:text-foreground"
                }
              >
                {item.label}
              </Link>
            )
          })}
          </nav>
          {(activeTab === "notes" ? showNotesSaveStatus : canEdit && activeTab !== "feed") ? (
            <p
              className="text-xs text-muted-foreground"
              aria-live="polite"
              aria-atomic="true"
            >
              {combinedSaveState === "saving"
                ? "저장 중…"
                : combinedSaveState === "offline"
                  ? "오프라인 — 연결 후 저장됩니다"
                  : null}
            </p>
          ) : null}
        </div>

        {activeTab === "tasks" ? (
          <TaskBoard
            tasks={room.tasks}
            members={room.members}
            canEdit={canEdit}
            userId={user?.id}
            canModerateComments={canModerateComments}
            subjectOptional={levelBoard}
            onAdd={addTask}
            onPatch={patchTask}
            onRemove={removeTask}
            onAddComment={addComment}
            onRemoveComment={removeComment}
          />
        ) : null}
        {activeTab === "groups" ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <GroupsPanel
              groups={room.groups ?? []}
              roster={initialRoster}
              roomCode={room.code}
              canEdit={canEdit}
              currentUserId={user?.id}
              onChange={patchGroups}
            />
          </div>
        ) : null}
        {activeTab === "notes" ? (
          <NotesPanel
            scope={notesBoard.scope}
            heading={notesBoard.heading}
            hint={notesBoard.hint}
            schoolFocus={notesBoard.schoolFocus}
            classNotes={normalizeSubjectNotes(room.subjectNotes, room.notes)}
            schoolNotes={schoolNotes}
            canEditClass={canEdit}
            canEditAnySchoolNote={canEditSchoolNotes}
            canEditSchoolNote={canEditSchoolNote}
            onClassChange={handleClassNotesChange}
            onSchoolChange={updateSchoolSubjectNote}
          />
        ) : null}
        {activeTab === "feed" ? (
          <UpdatesPanel
            updates={room.updates}
            user={user}
            canPost={canPostUpdates}
            showComposer={canAccessFeed}
            onPost={postUpdate}
            onRemove={removeUpdate}
          />
        ) : null}
      </div>
    </div>
  )
}

function formatDeadline(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date)
}

function CenteredState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-2 px-6 py-20 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <h1 className="text-base font-semibold">{title}</h1>
      <p className="text-sm leading-6 text-muted-foreground">{body}</p>
      {action}
    </div>
  )
}
