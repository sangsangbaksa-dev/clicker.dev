"use client"

import { CommunityPolicyNotice } from "@/components/policy/community-policy-notice"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { canRemoveRoomUpdate } from "@/domain/services/access-level"
import type { AuthUser, Update } from "@/domain/entities/board"
import { Trash2 } from "lucide-react"
import { memo, useState } from "react"
import { toast } from "sonner"

export const UpdatesPanel = memo(function UpdatesPanel({
  updates,
  user,
  canPost,
  showComposer,
  onPost,
  onRemove,
}: {
  updates: Update[]
  user: AuthUser | null
  canPost: boolean
  showComposer: boolean
  onPost: (text: string) => Promise<boolean>
  onRemove: (updateId: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const items = [...updates].reverse()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!canPost) {
      toast.message("뷰어는 소식을 올릴 수 없습니다.")
      return
    }
    setSubmitting(true)
    const posted = await onPost(draft)
    setSubmitting(false)
    if (posted) {
      setDraft("")
      toast.success("소식을 올렸습니다.")
    }
  }

  return (
    <div className="space-y-4">
      <CommunityPolicyNotice variant="feed" />
      {showComposer ? (
        <Card className="py-3 sm:py-4">
          <CardContent className="space-y-3 p-0 px-3 sm:px-4">
          <form noValidate onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            {canPost ? (
              <>
                <Label htmlFor="feed-draft">소식</Label>
                <p className="text-xs leading-5 text-muted-foreground">
                  자유롭게 반에서 일어난 소식을 써 주세요.
                </p>
                <Textarea
                  id="feed-draft"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="자유롭게 반에서 일어난 소식을 써 주세요."
                  rows={3}
                  maxLength={1000}
                />
              </>
            ) : (
              <>
                <p className="text-sm leading-none font-medium">소식</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  자유롭게 반에서 일어난 소식을 써 주세요.
                </p>
                <div className="min-h-16 rounded-md border border-input bg-input/30 px-2.5 py-2 text-sm text-muted-foreground md:min-h-16">
                  자유롭게 반에서 일어난 소식을 써 주세요.
                </div>
              </>
            )}
          </div>
          {!canPost ? (
            <p className="text-xs text-muted-foreground">
              뷰어는 소식 열람만 가능합니다.
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!canPost || submitting || !draft.trim()}
            >
              올리기
            </Button>
          </div>
          </form>
          </CardContent>
        </Card>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
          <h2 className="text-sm font-medium">소식 없음</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {canPost
              ? "위 입력란에 작성하세요."
              : showComposer
                ? "작성자·관리자가 올린 소식이 표시됩니다."
                : "회원이 올린 소식이 표시됩니다."}
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {items.map((update) => {
            const canDelete = user ? canRemoveRoomUpdate(user, update) : false
            return (
              <li key={update.id}>
                <Card className="py-3">
                  <CardContent className="px-4 py-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium">{update.author}</p>
                    <p className="text-sm leading-6 whitespace-pre-wrap">{update.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(update.createdAt)}
                    </p>
                  </div>
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="소식 삭제"
                      onClick={() => void onRemove(update.id)}
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
})

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
