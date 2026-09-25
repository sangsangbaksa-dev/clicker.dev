# HSMS — 화산중 수행평가 보드

**HSMS**(Hwasan Middle School System)는 화산중 1~4반 수행평가를 위한 내부용 웹앱입니다.  
할 일·노트·소식을 반별로 공유하고, 회원 승인·등급·전교 노트를 관리합니다.

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| 이름 | 화산중 (sohaengbang) |
| 용도 | 1~4반 수행평가 보드 |
| 사용자 | 승인된 회원 (교실 내부) |
| 저장 | `data/` JSON 파일 (로컬) / Netlify Blobs (배포 시) |
| 포트 | `8080` |

---

## 2. 기술 스택

- **프레임워크:** Next.js 16 (App Router), React 19, TypeScript
- **UI:** shadcn/ui, Tailwind CSS v4, tweakcn 테마
- **인증:** JWT 쿠키, bcrypt 비밀번호
- **아키텍처:** Clean Architecture (domain → application → infrastructure)

---

## 3. 실행 방법

```bash
npm install
npm run dev    # http://127.0.0.1:8080
npm run build  # 프로덕션 빌드
npm start      # 프로덕션 서버
```

Node.js 22 권장.

---

## 4. 화면·경로

| 경로 | 설명 |
|------|------|
| `/` | 홈 — 1~4반 목록, 플래너(주간 시간표) |
| `/ban/1` ~ `/ban/4` | 반별 보드 |
| `/ban/[n]?tab=notes` | 반 노트 탭 |
| `/ban/[n]?tab=feed` | 반 소식 탭 |
| `/login` | 로그인·회원가입 |
| `/pending` | 승인 대기 |
| `/approve` | 회원 승인 (관리자) |
| `/members` | 회원 목록·순서 (관리자) |
| `/settings` | 내 계정·프로필 |

### 반 보드 탭

- **할 일** — 과제·기한·담당·댓글
- **노트** — 과목별 반 노트
- **소식** — 반 공지·알림

---

## 5. 회원·권한

### 가입·승인

- 회원가입 시 **반(1~4)**, **영어·수학 반(S~E)** 선택
- 첫 가입자는 승인 없이 이용
- 이후 가입자는 관리자 승인 필요

### 등급

| 등급 | 설명 |
|------|------|
| 뷰어 | 열람만 |
| 작성자 | 자기 반 보드 수정, 소식 작성 |
| 관리자 | 전교 노트, 회원 관리, 타 반 열람 |
| 소유자 (Waldo) | 최고 권한 |

### 주요 규칙

- **자기 반** 회원만 해당 반 내용 수정 (관리자·소유자 예외)
- **다른 반** 보드는 열람만 가능
- 저장 충돌 시 **409** — 다른 사람이 먼저 저장한 경우

---

## 6. 주요 기능

### 홈

- 1~4반 목록 (할 일 수, 인원, 마감)
- **플래너** — 주간 시간표 모달. 주말은 30분 칸을 드래그해 여러 시간을 한 블록으로 묶음

### 반 보드

- 할 일 추가·기한·메모·담당·댓글
- 노트: 1~4반은 반별 노트만, 영어·수학 레벨 반은 영어·수학 노트만 (전환 없음)
- 과목별 노트 편집·변경 이력
- 소식 올리기·삭제 (본인 글만)
- 실시간 저장·충돌 처리

### 전교 노트

- 영어·수학 S~E반별 학교 공통 노트
- 등급에 따라 수정 가능 칸 제한

### 관리

- 가입 승인·거절·퇴출
- 회원 등급 변경
- 회원 표시 순서
- 프로필 변경 요청 승인

---

## 7. 프로젝트 구조

```
src/
├── app/              # Next.js 페이지·API (thin adapter)
├── application/      # 유스케이스 (auth, rooms, admin, …)
├── domain/           # 엔티티·비즈니스 규칙
├── infrastructure/   # JSON 저장, JWT, guard
├── shared/           # ids, classes, URL 헬퍼
├── components/       # UI (auth, room, planner, …)
└── styles/           # tweakcn-theme.css
data/
├── rooms/            # BAN1.json ~ BAN4.json
├── users/            # 회원 JSON
└── school-notes.json # 전교 노트
```

### application 유스케이스

| 파일 | 역할 |
|------|------|
| `auth.ts` | 로그인·회원가입 |
| `rooms.ts` | 방 조회·저장·소식·출석 |
| `admin.ts` | 승인·거절·회원·등급 |
| `classes.ts` | 반 목록 |
| `school-notes.ts` | 전교 노트 저장 |
| `notes-board.ts` | 반 종류 → 노트 표면 (반별/전교) |
| `home.ts` | 홈 데이터 |
| `result.ts` | ok/fail/toJson |

---

## 8. API (주요)

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/signup` | 회원가입 |
| GET | `/api/auth/me` | 현재 사용자 |
| GET/PUT/PATCH | `/api/rooms/[code]` | 반 조회·저장·소식·출석 |
| GET/PUT | `/api/school-notes` | 전교 노트 |
| GET | `/api/classes` | 반 요약 목록 |
| POST | `/api/auth/approve` | 승인 |
| POST | `/api/auth/reject` | 거절 |
| GET/PATCH | `/api/auth/members` | 회원 목록·순서 |

---

## 9. UI·테마

- **팔레트:** 종이 `#F6F3EE`, 배경 `#EDE8DF`, primary `#2F6F7E` (딥 틸)
- **설정:** `src/styles/tweakcn-theme.css`, [tweakcn.com](https://tweakcn.com)에서 Export
- **컴포넌트:** shadcn/ui (`src/components/ui/`)

---

## 10. 개발·에이전트

- **아키텍처:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **스킬:** `.cursor/skills/frontend-design`, `.cursor/skills/shadcn-tweakcn`
- **테스트:** `node scripts/test-save-safety.mjs`, `node scripts/test-class-posting.mjs`

---

## 11. 주의

- 개인정보(전화번호, 주소, 비밀번호 등)를 보드에 올리지 마세요.
- Netlify 배포는 별도 설정 필요 (Blobs 환경 변수).

---

*문서 버전: 2026-09 · 프로젝트 main 브랜치 기준*
