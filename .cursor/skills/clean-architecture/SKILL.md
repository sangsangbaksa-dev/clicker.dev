---
name: clean-architecture
description: Apply this repo's Clean Architecture when adding or changing features — domain rules first, then application use cases, then infrastructure and API, then UI. Use when building features, APIs, board behavior, 조, notes, auth, or when the user asks to follow Clean Architecture.
---

# HSMS Clean Architecture

Follow this skill for every feature in this repo. Do not start in a React component or a route file.

```
components, app/  →  application/  →  domain/
                         ↓
                  infrastructure/
```

| Path | Allowed to know | Must not know |
|------|-----------------|---------------|
| `src/domain/` | Types, invariants, pure functions | Next.js, fetch, cookies, Blob/JSON IO, JSX |
| `src/application/` | Use cases: load → authorize → domain apply → persist | JSX, CSS, route URL parsing beyond input DTOs |
| `src/infrastructure/` | JSON/Blobs, JWT, cookies, HTTP guard | Feature policy (put that in domain) |
| `src/app/api/` | `guard` → application function → `toJson()` | Domain mutation logic |
| `src/components/`, `src/hooks/` | Render + call APIs | Persistence, JWT, inventing authorization rules |

`src/shared/` is ids, class codes, URL helpers — not business policy.

## Workflow (run in this order)

1. **Name the use case** in one sentence (actor, action, invariant).
2. **Domain**
   - Add or extend types in `src/domain/entities/`.
   - Put rules in `src/domain/services/<feature>.ts`.
   - Cover the rules with `src/domain/services/<feature>.test.ts`.
   - Domain tests may `import` with `.ts` suffixes. Production domain files: **type-only** `@/` imports when a value import would break `node --experimental-strip-types` tests.
3. **Application**
   - One file per feature area (`src/application/<feature>.ts`).
   - Return `UseCaseResult` via `ok` / `fail` from `src/application/result.ts`.
   - Authorize with `src/domain/services/access-level.ts` (do not copy Waldo/owner checks into UI).
   - Persist only through existing repositories.
4. **Infrastructure** (only if storage/auth must change)
   - Repositories map records in and out. They call domain sanitizers; they do not invent membership or merge rules.
5. **API route**
   - `requireApprovedUser` / `requireEditorUser` then application then `toJson()`.
   - `export const dynamic = "force-dynamic"` and `runtime = "nodejs"` on mutating or cookie routes.
6. **UI**
   - shadcn/ui primitives already in `src/components/ui/`.
   - Empty, loading, forbidden, and conflict states.
   - Korean copy, same voice as the rest of the board.

## Persistence rules (serverless)

Shared JSON/Blob stores can return an empty document when the store is merely unavailable. Never treat an empty read as “wipe the school”:

- Fresh-load before write (`getRoomFresh`, `loadRoomDirectory({ fresh: true })`).
- Abort the write when the store is unreliable and the payload would replace known data with empty.
- On 409, merge with `src/domain/services/conflict-merge.ts` (3-way: local / remote / last synced). Do not take last-write-wins for notes or documents.

## Collaborative surfaces

- **Class notes / 할 일 / 소식 / 조 명단** live on `Room` and go through room GET/PUT.
- **조 공동 문서·대화** are separate models: membership stays on `Room.groups`, document bodies and chat messages are stored on the group but **stripped from board GET/PUT**. Use `/api/rooms/[code]/groups/[groupId]/live` to poll both, documents CRUD under `.../documents`, chat under `.../messages`. On room PUT, preserve stored documents and messages.
- Only that 조의 `memberIds` may read or write its documents and chat. Site admins who are not 조원 cannot open them.

## Auth invariants (do not rewrite)

- Owner is loginId `waldo` (case-insensitive), display name 이찬형. `WALDO_LOGIN_ID` stays `"waldo"`.
- Do not invent a second owner, rename the owner check, or block clearing the owner's *records* if that use case already exists. 퇴출 still cannot expel Waldo.

## Checks before done

```bash
npm test
npx tsc --noEmit
```

`npm test` is `node --experimental-strip-types --test src/domain/services/*.test.ts src/infrastructure/persistence/*.test.ts`. New domain rules need a test in that glob. Keep `**/*.test.ts` out of the Next typecheck.

## Anti-patterns

- Business `if` in a route handler or React event handler that is not already a domain function.
- Importing `room-repository` from `components/` or `domain/`.
- Putting 조 문서 본문 on the board GET/PUT payload (it races with 조 명단 autosave).
- Chat, DM, or “thread” features that skip domain rules and ride on board GET/PUT.
- New auth providers, databases, or a second component library.
