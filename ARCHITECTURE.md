# 레이어

```
components, app/  →  application/  →  domain/
                         ↓
                  infrastructure/
```

| 경로 | 역할 |
|------|------|
| `domain/` | 타입·권한·순수 규칙 (프레임워크 무관). 노트 범위는 `notes-scope.ts`, 조 문서는 `group-docs.ts`, 조 대화는 `group-chat.ts` |
| `application/` | `auth.ts`, `rooms.ts`, `group-docs.ts`, `group-chat.ts`, `group-collab.ts`, `admin.ts`, `classes.ts`, `school-notes.ts`, `notes-board.ts`, `home.ts`, `result.ts` |
| `infrastructure/` | JSON/Blobs, JWT, guard |
| `shared/` | ids, classes, URL, sync 간격 |

API: guard → application 함수 → `toJson()`. 새 기능은 `.cursor/skills/clean-architecture/SKILL.md` 순서(domain → application → infrastructure → route → UI)를 따른다.

조 명단은 `Room.groups`에 두고 보드 GET/PUT으로 다룬다. 조 문서·대화 본문은 보드 JSON에서 빼고, `GET /api/rooms/[code]/groups/[groupId]/live`로 함께 폴링한다. 문서 저장은 `.../documents`, 대화는 `.../messages`. 조원(`memberIds`)과 사이트 관리자만 연다. 보드 PUT은 저장된 종이·대화를 지워서는 안 된다.
