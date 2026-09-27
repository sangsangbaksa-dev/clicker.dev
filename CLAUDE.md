@AGENTS.md

# Deploy

수정 사항은 바로 배포한다: 작업 브랜치에 커밋·푸시한 뒤 곧바로 `main`에 fast-forward 병합하고 `git push origin main`까지 한다 (Vercel이 `main`을 배포). 배포 전 `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`가 통과해야 한다.
