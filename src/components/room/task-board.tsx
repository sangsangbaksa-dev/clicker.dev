"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Member, Task, TaskComment } from "@/domain/entities/board"
import {
  formatTaskDue,
  isDueSoonTask,
  isOverdueTask,
  pruneExpiredTasks,
} from "@/domain/services/task-rules"
import { AddTaskToPlannerButton } from "@/components/planner/add-task-to-planner"
import { CalendarClock, MessageSquare, Plus, Trash2 } from "lucide-react"
import { memo, useMemo, useState } from "react"
import { toast } from "sonner"

export const TaskBoard = memo(function TaskBoard({
  tasks,
  members,
  canEdit,
  userId,
  canModerateComments,
  subjectOptional = false,
  onAdd,
  onPatch,
  onRemove,
  onAddComment,
  onRemoveComment,
}: {
  tasks: Task[]
  members: Member[]
  canEdit: boolean
  userId?: string
  canModerateComments?: boolean
  subjectOptional?: boolean
  onAdd: (title: string, dueDate?: string) => boolean
  onPatch: (taskId: string, patch: Partial<Task>) => void
  onRemove: (taskId: string) => void
  onAddComment: (taskId: string, text: string) => void
  onRemoveComment: (taskId: string, commentId: string) => void
}) {
  const [draft, setDraft] = useState("")
  const [draftDue, setDraftDue] = useState("")

  const sortedTasks = useMemo(() => sortTasks(pruneExpiredTasks(tasks)), [tasks])

  function addDraft() {
    const title = draft.trim()
    if (!title) {
      toast.error("할 일 내용을 입력해 주세요.")
      return
    }
    if (!canEdit) {
      toast.message("할 일을 추가할 수 있는 권한이 없습니다.")
      return
    }
    const added = onAdd(title, draftDue || undefined)
    if (added) {
      setDraft("")
      setDraftDue("")
      toast.success("할 일을 추가했습니다.")
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    addDraft()
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <Card className="py-3 sm:py-4">
          <form noValidate onSubmit={submit} className="flex flex-col gap-3 px-3 sm:px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={draft}
              placeholder={
                subjectOptional
                  ? "수행평가 이름(ex. 통계프로젝트 발표 대본 만들기)"
                  : "과목명-수행평가 이름(ex. 사회-아시아 지도 만들기)"
              }
              className="flex-1"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  addDraft()
                }
              }}
            />
            <Button type="button" className="sm:w-auto" onClick={addDraft}>
              <Plus />
              추가
            </Button>
          </div>
          {subjectOptional ? (
            <p className="text-xs leading-5 text-muted-foreground">
              이 반은 할 일을 넣을 때 과목을 입력하지 않아도 됩니다.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="task-draft-due" className="text-xs text-muted-foreground">
              기한 (선택)
            </Label>
            <Input
              id="task-draft-due"
              type="date"
              value={draftDue}
              className="w-auto"
              onChange={(event) => setDraftDue(event.target.value)}
            />
            {draftDue ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setDraftDue("")}
              >
                기한 없음
              </Button>
            ) : null}
          </div>
          </form>
        </Card>
      ) : null}

      {sortedTasks.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          {canEdit
            ? "위 입력란에 추가하세요."
            : "등록된 할 일이 없습니다."}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sortedTasks.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                members={members}
                canEdit={canEdit}
                userId={userId}
                canModerateComments={canModerateComments}
                onPatch={onPatch}
                onRemove={onRemove}
                onAddComment={onAddComment}
                onRemoveComment={onRemoveComment}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})

function TaskCard({
  task,
  members,
  canEdit,
  userId,
  canModerateComments,
  onPatch,
  onRemove,
  onAddComment,
  onRemoveComment,
}: {
  task: Task
  members: Member[]
  canEdit: boolean
  userId?: string
  canModerateComments?: boolean
  onPatch: (taskId: string, patch: Partial<Task>) => void
  onRemove: (taskId: string) => void
  onAddComment: (taskId: string, text: string) => void
  onRemoveComment: (taskId: string, commentId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [commentDraft, setCommentDraft] = useState("")
  const overdue = isOverdueTask(task.dueDate)
  const dueSoon = !overdue && isDueSoonTask(task.dueDate)
  const comments = task.comments ?? []

  function submitComment() {
    const text = commentDraft.trim()
    if (!text) {
      toast.error("댓글 내용을 입력해 주세요.")
      return
    }
    if (!canEdit) return
    onAddComment(task.id, text)
    setCommentDraft("")
  }

  return (
    <Card
      size="sm"
      className={`bg-card shadow-[var(--surface-shadow)] ${overdue ? "border-destructive" : dueSoon ? "border-primary/40" : ""}`}
    >
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <CardTitle className="text-sm leading-5">{task.title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {task.assigneeIds.length === 0
                ? "담당 없음"
                : task.assigneeIds
                    .map((id) => members.find((item) => item.id === id)?.name ?? "모름")
                    .join(", ")}
            </p>
          </div>
          {canEdit ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="할 일 삭제"
              onClick={() => onRemove(task.id)}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {task.dueDate ? (
            <span
              className={`inline-flex items-center gap-1 text-xs ${
                overdue ? "text-destructive" : dueSoon ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <CalendarClock className="size-3" />
              {overdue ? "기한 지남 · " : dueSoon ? "마감 임박 · " : ""}
              {formatTaskDue(task.dueDate)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">기한 없음</span>
          )}
          {canEdit ? (
            <Input
              type="date"
              value={task.dueDate}
              aria-label={`${task.title} 기한`}
              className="h-8 w-auto text-xs"
              onChange={(event) => onPatch(task.id, { dueDate: event.target.value })}
            />
          ) : null}
          <AddTaskToPlannerButton
            title={task.title}
            notes={task.notes}
            dueDate={task.dueDate}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "메모 접기" : task.notes ? "메모 보기" : "메모·담당 적기"}
          </Button>
        ) : task.notes ? (
          <p className="text-sm leading-6 text-muted-foreground">{task.notes}</p>
        ) : null}
        {open && canEdit ? (
          <div className="grid gap-2">
            <Textarea
              value={task.notes}
              placeholder="짧게 적어두기. 예: 사진 찍을 때 얼굴 나오지 않게"
              onChange={(event) => onPatch(task.id, { notes: event.target.value })}
            />
            <div className="flex flex-wrap gap-1">
              {members.map((member) => {
                const assigned = task.assigneeIds.includes(member.id)
                return (
                  <Button
                    key={member.id}
                    size="xs"
                    variant={assigned ? "default" : "outline"}
                    onClick={() => {
                      const assigneeIds = assigned
                        ? task.assigneeIds.filter((id) => id !== member.id)
                        : [...task.assigneeIds, member.id]
                      onPatch(task.id, { assigneeIds })
                    }}
                  >
                    {member.name}
                  </Button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div className="space-y-2 border-t border-border/60 pt-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageSquare className="size-3.5" />
            댓글 {comments.length > 0 ? comments.length : ""}
          </div>
          {comments.length > 0 ? (
            <ul className="space-y-2">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  canDelete={
                    canEdit &&
                    Boolean(
                      userId &&
                        (comment.authorId === userId || canModerateComments)
                    )
                  }
                  onDelete={() => onRemoveComment(task.id, comment.id)}
                />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">댓글 없음</p>
          )}
          {canEdit ? (
            <div className="flex gap-2">
              <Input
                value={commentDraft}
                placeholder="댓글 남기기…"
                className="h-8 text-sm"
                onChange={(event) => setCommentDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    submitComment()
                  }
                }}
              />
              <Button type="button" size="sm" variant="outline" onClick={submitComment}>
                등록
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function CommentItem({
  comment,
  canDelete,
  onDelete,
}: {
  comment: TaskComment
  canDelete: boolean
  onDelete: () => void
}) {
  return (
    <li className="group flex gap-2 rounded-lg bg-muted/50 px-2.5 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{comment.author}</p>
        <p className="leading-5 break-words">{comment.text}</p>
      </div>
      {canDelete ? (
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0 opacity-60 group-hover:opacity-100"
          aria-label="댓글 삭제"
          onClick={onDelete}
        >
          <Trash2 />
        </Button>
      ) : null}
    </li>
  )
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aDue = a.dueDate ? new Date(`${a.dueDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY
    const bDue = b.dueDate ? new Date(`${b.dueDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY
    if (aDue !== bDue) return aDue - bDue
    return new Date(b.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
}
