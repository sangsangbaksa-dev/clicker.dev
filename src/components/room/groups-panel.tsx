"use client"

import { GroupCollabPanel } from "@/components/room/group-collab-panel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ClassGroup } from "@/domain/entities/board"
import {
  commitGroupEdit,
  groupForMember,
  groupLabel,
  MAX_CLASS_GROUPS,
  nextGroupNumber,
  personName,
  removeGroup,
  ungroupedIds,
  type GroupPerson,
} from "@/domain/services/class-groups"
import { createId } from "@/shared/ids"
import { useEffect, useMemo, useState } from "react"

type EditorState = {
  id: string
  n: number
  name: string
  memberIds: string[]
  createdAt: string
}

function namesFor(ids: string[], roster: GroupPerson[]): string {
  return ids
    .map((id) => personName(roster, id))
    .filter(Boolean)
    .join(", ")
}

function otherGroupOf(
  groups: ClassGroup[],
  personId: string,
  currentId: string
): ClassGroup | undefined {
  return groups.find(
    (group) => group.id !== currentId && group.memberIds.includes(personId)
  )
}

export function GroupsPanel({
  groups,
  roster: initialRoster,
  roomCode,
  canEdit,
  currentUserId,
  onChange,
}: {
  groups: ClassGroup[]
  roster: GroupPerson[]
  roomCode: string
  canEdit: boolean
  currentUserId?: string
  onChange: (groups: ClassGroup[]) => void
}) {
  const [roster, setRoster] = useState(initialRoster)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [openDocsId, setOpenDocsId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<ClassGroup | null>(null)

  useEffect(() => {
    setRoster(initialRoster)
  }, [initialRoster])

  useEffect(() => {
    if (initialRoster.length > 0) return
    let cancelled = false
    fetch(`/api/classes/roster?code=${encodeURIComponent(roomCode)}`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const body = (await response.json()) as { roster?: GroupPerson[] }
        if (!cancelled && Array.isArray(body.roster)) setRoster(body.roster)
      })
      .catch(() => {
        /* roster stays empty; names just omit */
      })
    return () => {
      cancelled = true
    }
  }, [initialRoster.length, roomCode])

  const rosterIds = useMemo(() => roster.map((person) => person.id), [roster])
  const leftover = ungroupedIds(rosterIds, groups)
  const myGroup = currentUserId ? groupForMember(groups, currentUserId) : undefined
  const requestedDocsId =
    openDocsId && groups.some((group) => group.id === openDocsId)
      ? openDocsId
      : myGroup?.id
  const docsGroup = requestedDocsId
    ? groups.find((group) => group.id === requestedDocsId)
    : undefined

  function canOpenDocs(group: ClassGroup) {
    return Boolean(currentUserId && group.memberIds.includes(currentUserId))
  }

  const visibleDocsId = docsGroup && canOpenDocs(docsGroup) ? docsGroup.id : undefined

  function openEditor(group: ClassGroup) {
    setEditor({
      id: group.id,
      n: group.n,
      name: group.name,
      memberIds: [...group.memberIds],
      createdAt: group.createdAt,
    })
  }

  function addGroup() {
    if (groups.length >= MAX_CLASS_GROUPS) return
    const createdAt = new Date().toISOString()
    setEditor({
      id: createId("grp"),
      n: nextGroupNumber(groups),
      name: "",
      memberIds: [],
      createdAt,
    })
  }

  function saveEditor() {
    if (!editor) return
    onChange(
      commitGroupEdit(groups, {
        id: editor.id,
        createdAt: editor.createdAt,
        name: editor.name,
        memberIds: editor.memberIds,
      })
    )
    setEditor(null)
  }

  function closeEditor() {
    setEditor(null)
  }

  function requestDelete(group: ClassGroup) {
    setPendingDelete(group)
  }

  function deleteEditing() {
    if (!editor) return
    const existing = groups.find((group) => group.id === editor.id)
    if (existing) {
      requestDelete(existing)
      return
    }
    setEditor(null)
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    onChange(removeGroup(groups, id))
    if (openDocsId === id) setOpenDocsId(null)
    if (editor?.id === id) setEditor(null)
    setPendingDelete(null)
  }

  function toggleMember(personId: string, checked: boolean) {
    setEditor((current) => {
      if (!current) return current
      const memberIds = checked
        ? [...current.memberIds.filter((id) => id !== personId), personId]
        : current.memberIds.filter((id) => id !== personId)
      return { ...current, memberIds }
    })
  }

  const docsOpen = Boolean(visibleDocsId)

  return (
    <div className={docsOpen ? "flex min-h-0 flex-1 flex-col gap-2" : "space-y-3"}>
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 조가 없습니다.</p>
      ) : (
        <ul
          className={
            docsOpen
              ? "flex shrink-0 flex-wrap items-center gap-1"
              : "divide-y divide-border border-y border-border"
          }
        >
          {groups.map((group) => {
            const members = namesFor(group.memberIds, roster)
            const mine = group.id === myGroup?.id
            const selected = group.id === visibleDocsId
            if (docsOpen && !canOpenDocs(group)) return null
            return (
              <li
                key={group.id}
                className={
                  docsOpen
                    ? "flex items-center"
                    : "flex items-start justify-between gap-3 py-2.5"
                }
              >
                {docsOpen ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={selected ? "secondary" : "ghost"}
                    onClick={() => setOpenDocsId(group.id)}
                  >
                    {groupLabel(group)}
                    {mine ? " · 내 조" : ""}
                  </Button>
                ) : (
                  <>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium">
                        {groupLabel(group)}
                        {mine ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            내 조
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {members || "조원 없음"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {canOpenDocs(group) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setOpenDocsId(group.id)}
                        >
                          문서
                        </Button>
                      ) : null}
                      {canEdit ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditor(group)}
                          >
                            고치기
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => requestDelete(group)}
                          >
                            삭제
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </>
                )}
              </li>
            )
          })}
          {docsOpen && canEdit ? (
            <li className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const target = groups.find((group) => group.id === visibleDocsId)
                  if (target) openEditor(target)
                }}
              >
                고치기
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const target = groups.find((group) => group.id === visibleDocsId)
                  if (target) requestDelete(target)
                }}
              >
                삭제
              </Button>
            </li>
          ) : null}
        </ul>
      )}

      {!docsOpen && groups.length > 0 && leftover.length > 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">
          조 없음 · {namesFor(leftover, roster)}
        </p>
      ) : null}

      {canEdit && !docsOpen ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={groups.length >= MAX_CLASS_GROUPS}
            onClick={addGroup}
          >
            조 만들기
          </Button>
          {groups.length >= MAX_CLASS_GROUPS ? (
            <span className="text-xs text-muted-foreground">조는 12개까지입니다.</span>
          ) : null}
        </div>
      ) : null}

      {visibleDocsId ? (
        <div className="min-h-0 flex-1">
          <GroupCollabPanel
            roomCode={roomCode}
            groupId={visibleDocsId}
            people={roster.filter((person) =>
              (groups.find((group) => group.id === visibleDocsId)?.memberIds ?? []).includes(
                person.id
              )
            )}
            currentUserId={currentUserId}
          />
        </div>
      ) : groups.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          소속 조 조원만 공동 문서와 대화를 볼 수 있습니다.
        </p>
      ) : null}

      <Dialog open={Boolean(editor)} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>{editor ? groupLabel(editor) : "조"}</DialogTitle>
            <DialogDescription>이 반 회원만 조에 넣을 수 있습니다.</DialogDescription>
          </DialogHeader>
          {editor ? (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="group-name">이름 (선택)</Label>
                <Input
                  id="group-name"
                  value={editor.name}
                  maxLength={20}
                  placeholder="비워 두면 번호만 씁니다"
                  onChange={(event) =>
                    setEditor({ ...editor, name: event.target.value })
                  }
                />
              </div>
              <fieldset className="grid gap-1.5">
                <legend className="text-sm font-medium">조원</legend>
                {roster.length === 0 ? (
                  <p className="text-sm text-muted-foreground">이 반에 등록된 회원이 없습니다.</p>
                ) : (
                  <ul className="max-h-56 space-y-1 overflow-auto border border-border px-2 py-1.5">
                    {roster.map((person) => {
                      const checked = editor.memberIds.includes(person.id)
                      const other = otherGroupOf(groups, person.id, editor.id)
                      return (
                        <li key={person.id}>
                          <label className="flex cursor-pointer items-center gap-2 py-0.5 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                toggleMember(person.id, event.target.checked)
                              }
                            />
                            <span>{person.name}</span>
                            {other && !checked ? (
                              <span className="text-xs text-muted-foreground">
                                {groupLabel(other)}
                              </span>
                            ) : null}
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </fieldset>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            {editor && groups.some((group) => group.id === editor.id) ? (
              <Button type="button" variant="ghost" onClick={deleteEditing}>
                조 삭제
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={closeEditor}>
                닫기
              </Button>
              <Button type="button" onClick={saveEditor}>
                저장
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {pendingDelete ? `${groupLabel(pendingDelete)}를 삭제할까요?` : "조 삭제"}
            </DialogTitle>
            <DialogDescription>
              조원 명단과 공동 문서·대화도 함께 지워집니다. 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              취소
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
