# 화산중 수행평가 보드

1~4반과 영어·수학 S~E반 수행평가 할 일, 노트, 소식을 공유하는 내부용 웹앱입니다.

## 폴더 구조

[ARCHITECTURE.md](./ARCHITECTURE.md) — `domain` → `application` → `infrastructure`, UI는 `components`/`app`.

## 사용

- 승인된 회원만 보드 열람·수정
- 가입 후 관리자 승인 필요 (첫 가입자는 승인 없이 이용)
- 반별 보드: 할 일, 조, 노트, 소식. 각 조는 조원만 여는 공동 문서와 대화를 가진다.

개인정보(전화번호, 주소, 계정 비밀번호 등)는 올리지 마세요.

## 테마 (shadcn + tweakcn)

- UI: [shadcn/ui](https://ui.shadcn.com) (`components/ui/`, `npx shadcn add …`)
- 색·radius: [tweakcn](https://tweakcn.com) → Export Tailwind v4 → `src/styles/tweakcn-theme.css`에 붙여넣기
- 메타: `tweakcn.theme.json`, `components.json`
- Cursor 에이전트 스킬:
  - `.cursor/skills/clean-architecture/SKILL.md` — domain → application → infrastructure → API → UI
  - `.cursor/skills/frontend-design/SKILL.md` — UI 미학·카피 (Anthropic frontend-design)
  - `.cursor/skills/shadcn-tweakcn/SKILL.md` — shadcn/tweakcn 구현

## 로컬 실행

Node.js 22 필요.

```bash
npm install
npm run dev
```

[http://127.0.0.1:8080](http://127.0.0.1:8080)

## 플래너

- 평일: 월~목 1~8교시·야자·기숙, 금요일은 1~7교시까지
- 주말: 금요일 하교(7교시 이후) + 토·일, 아침 7시~밤 1시 30분 칸. 드래그하면 여러 칸을 한 블록으로 묶음
- 주가 바뀌면 매주 반복이 아닌 칸은 색상까지 모두 지워짐
- 브라우저 `localStorage`에 저장 (`hsms-planner-timetable-v1`)

## 배포

### Supabase + Vercel (권장)

Vercel에 Next.js를 올리고, **Vercel Blob 대신 Supabase Storage**에 회원·반·할 일 JSON을 저장합니다.

1. [Supabase](https://supabase.com/dashboard) → New project
2. SQL Editor에서 `supabase/migrations/20260920110000_hsms_storage.sql` 실행
3. Project Settings → API → **URL**, **service_role** 키 복사
4. [Vercel](https://vercel.com/waldo5/hsms-md/settings/environment-variables) → Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (Sensitive)
   - `AUTH_SECRET` (Sensitive, `openssl rand -base64 32`)
5. 재배포 후 `node scripts/supabase-setup.mjs`로 Storage 연결 확인

`BLOB_READ_WRITE_TOKEN`은 더 이상 필요하지 않습니다(설정돼 있어도 코드가 사용하지 않음).

### Supabase + Netlify

Supabase는 **데이터 저장소**(Storage)이고, Next.js 앱은 **Netlify**에 올립니다.

1. [Supabase](https://supabase.com/dashboard)에서 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/migrations/20260920110000_hsms_storage.sql` 내용을 실행하거나, 로컬에서 `npx supabase link` 후 `npx supabase db push` 합니다.
3. Project Settings → API에서 **URL**과 **service_role** 키를 복사합니다.
4. [Netlify](https://app.netlify.com) → Add new site → Import from Git → 저장소 연결.
5. Build command: `npm run build`, Publish: `.next` (Netlify가 Next.js 16을 자동 감지).
6. Environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AUTH_SECRET`
7. Deploy 후 `node scripts/supabase-setup.mjs`로 Storage 연결을 확인합니다.

검증:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/supabase-setup.mjs
```

### Vercel (레거시)

앱 본문은 Vercel(`https://hsms-md.vercel.app`)에 둘 수 있습니다. Hobby Blob 한도에 걸리면 Supabase Storage로 옮기는 것을 권장합니다.

한국에서 정적 파일(JS/CSS/폰트)을 빠르게 받도록 Cloudflare 계정 `e8fbc690d9c26810ae8cc1ee9f83c814`에 엣지 Worker(`hsms-md-edge`)를 붙입니다. HTML·API는 Vercel 원본으로 통과하고, `/_next/static`만 엣지에 캐시합니다.

Cloudflare Workers Git 연동은 GitHub/GitLab만 지원합니다. Cursor Origin 원격은 연결할 수 없습니다.

### GitHub 미러

```bash
GITHUB_TOKEN=ghp_... ./scripts/mirror-to-github.sh YOUR_GITHUB_USER/hsms-md
```

GitHub 저장소 Settings → Secrets → Actions에 `CLOUDFLARE_API_TOKEN`을 넣으면 `main` 푸시 때 Worker가 배포됩니다. 토큰은 [Cloudflare dashboard](https://dash.cloudflare.com/e8fbc690d9c26810ae8cc1ee9f83c814/home) → My Profile → API Tokens → Edit Cloudflare Workers 권한으로 만듭니다.

### Cloudflare 대시보드에서 Git 연결

1. [Workers & Pages](https://dash.cloudflare.com/e8fbc690d9c26810ae8cc1ee9f83c814/workers-and-pages) → Create → Import a repository
2. GitHub의 `hsms-md`를 선택합니다. Next.js 프레임워크 프리셋이 아니라 **Worker**로 가져옵니다.
3. Root directory를 `cloudflare`로 둡니다.
4. Deploy command: `npx wrangler deploy`

배포 후 `https://hsms-md-edge.<subdomain>.workers.dev` 가 한국 엣지 주소입니다.

로컬에서 Worker만 시험:

```bash
npm run cf:test
npm run cf:dev
```

[http://127.0.0.1:8788](http://127.0.0.1:8788) 이 Vercel 원본을 프록시합니다.

## 데이터

로컬에서는 회원·방·노트를 `data/` 아래 JSON 파일로 저장합니다.

서버리스 배포(Netlify·Vercel)에서는 함수의 `/tmp`가 비워집니다. 회원·반·할 일 JSON은 **Supabase Storage** 버킷 `hsms-md`에 둡니다(`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 설정 시). 퇴출 tombstone(`deletedIds`)이 번들 명단·백업보다 우선하므로, 삭제한 회원(Waldo2 포함)은 새로고침 후에도 돌아오지 않습니다. 소유자 아이디는 정확히 `waldo`만 보호됩니다.

레거시: Vercel Blob(`BLOB_READ_WRITE_TOKEN`) 또는 Netlify Blobs도 지원하지만, Supabase가 설정되면 Supabase가 우선합니다.

### 환경 변수

| 이름 | 언제 | 설명 |
|------|------|------|
| `AUTH_SECRET` | 운영 필수 | 로그인 세션 서명 키. 32자 이상 임의 문자열(`openssl rand -base64 32`). 없으면 운영에서 로그인·API가 오류를 냅니다. |
| `SUPABASE_URL` | Supabase 배포 | 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 배포 | 서버 전용 키 (Netlify env에만, 클라이언트 노출 금지) |
| `BLOB_READ_WRITE_TOKEN` | Vercel 레거시 | Vercel Blob 토큰 |
| `NETLIFY` | Netlify | `netlify.toml`에서 자동 설정 |
| `DATA_DIR` | 로컬 선택 | JSON 파일 루트. 없으면 `data/`, 서버리스는 `/tmp/hsms-data`. |

할 일은 `data/tasks.json` 시드와 Storage `hsms-md/tasks/{반}/{할일id}.json`에 따로 저장합니다. 삭제한 할 일 id는 ledger `droppedIds`에 남아 번들 시드가 다시 살리지 못합니다.
