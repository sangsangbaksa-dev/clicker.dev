"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { useGroupLive } from "@/hooks/use-group-live"
import { ImagePlus, SendHorizontal } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

function closeInTime(a: string, b: string) {
  const left = new Date(a).getTime()
  const right = new Date(b).getTime()
  if (Number.isNaN(left) || Number.isNaN(right)) return false
  return Math.abs(right - left) < 3 * 60 * 1000
}

function initial(name: string) {
  return name.trim().slice(0, 1) || "?"
}

function clock(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
}

export function GroupChatPanel({
  live,
  currentUserId,
}: {
  live: ReturnType<typeof useGroupLive>
  currentUserId?: string
}) {
  const { chat, typing, status, sendChat } = live
  const [draft, setDraft] = useState("")
  const [image, setImage] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const messages = useMemo(() => chat?.messages ?? [], [chat?.messages])

  const clusters = useMemo(() => {
    return messages.map((message, index) => {
      const previous = messages[index - 1]
      const grouped = Boolean(
        previous &&
          previous.authorId === message.authorId &&
          closeInTime(previous.createdAt, message.createdAt)
      )
      return { message, grouped }
    })
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [messages.length])

  const chatTyping = typing.filter(
    (item) => item.surface === "chat" && item.userId !== currentUserId
  )

  async function submit() {
    if (sending || !chat?.canPost) return
    setSending(true)
    const ok = await sendChat(draft, image)
    setSending(false)
    if (ok) {
      setDraft("")
      setImage(null)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  if (status === "forbidden" || status === "missing") return null

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-border bg-card">
      <div className="border-b border-border px-3 py-2">
        <h2 className="text-sm font-medium">{chat?.title ?? "조 대화"}</h2>
        <p className="text-xs text-muted-foreground">조원만 보고 보냅니다</p>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-auto px-3 py-3">
        {messages.length === 0 ? (
          <p className="pt-6 text-center text-sm text-muted-foreground">
            아직 대화가 없습니다. 첫 메시지를 보내 보세요.
          </p>
        ) : (
          clusters.map(({ message, grouped }) => {
            const mine = message.mine || message.authorId === currentUserId
            return (
              <div
                key={message.id}
                className={`flex gap-2 ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-3"}`}
              >
                {!mine && !grouped ? (
                  <Avatar size="sm" className="mt-1">
                    <AvatarFallback>{initial(message.author)}</AvatarFallback>
                  </Avatar>
                ) : (
                  <span className="size-6 shrink-0" />
                )}
                <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                  {!mine && !grouped ? (
                    <p className="px-1 text-xs text-muted-foreground">{message.author}</p>
                  ) : null}
                  <div
                    className={`rounded-2xl px-3 py-1.5 text-sm leading-6 ${
                      mine
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md bg-muted text-foreground"
                    }`}
                  >
                    {message.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={message.imageUrl}
                        alt=""
                        className="mb-1 max-h-48 rounded-md object-cover"
                      />
                    ) : null}
                    {message.body ? <p className="whitespace-pre-wrap">{message.body}</p> : null}
                  </div>
                  {!grouped ? (
                    <p className="px-1 text-[10px] text-muted-foreground">{clock(message.createdAt)}</p>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
        {chatTyping.length > 0 ? (
          <p className="px-1 pt-2 text-xs text-muted-foreground">
            {chatTyping.map((item) => item.name).join(", ")} 입력 중…
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {chat?.canPost ? (
        <form
          className="flex flex-col gap-2 border-t border-border p-2"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          {image ? (
            <p className="truncate px-1 text-xs text-muted-foreground">{image.name}</p>
          ) : null}
          <div className="flex items-end gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="사진"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus />
            </Button>
            <textarea
              value={draft}
              rows={1}
              placeholder="메시지"
              className="max-h-24 min-h-9 flex-1 resize-none rounded-md border border-input bg-transparent px-2.5 py-2 text-sm outline-none"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void submit()
                }
              }}
            />
            <Button type="submit" size="icon-sm" disabled={sending} aria-label="보내기">
              <SendHorizontal />
            </Button>
          </div>
        </form>
      ) : (
        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          이 조 조원만 메시지를 보낼 수 있습니다.
        </p>
      )}
    </div>
  )
}
