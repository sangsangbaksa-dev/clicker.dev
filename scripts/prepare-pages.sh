#!/usr/bin/env bash
# GitHub Pages 빌드 전용: 작업 트리를 클리커 정적 사이트용으로 바꾼다. CI에서만 실행할 것 (파일을 지운다).
# 사용: PAGES_BASE_PATH=/clicker.dev bash scripts/prepare-pages.sh
set -euo pipefail
base="${PAGES_BASE_PATH:-}"

# 서버(API·인증·방) 라우트는 정적 export가 불가능하므로 제거한다. 클리커는 / 하나뿐이다.
rm -rf src/app/api src/app/ban src/app/r src/app/approve src/app/pending \
  src/app/settings src/app/login src/app/members

# public/ 자산을 가리키는 절대 경로에 basePath를 붙인다.
if [ -n "$base" ]; then
  grep -rlE "[\"'\`(]/(clicker|brand)/" src --include=*.ts --include=*.tsx --include=*.css \
    | xargs -r sed -i -E "s#([\"'\`(])/(clicker|brand)/#\1${base}/\2/#g"
  sed -i -E "s#start_url: \"/\"#start_url: \"${base}/\"#" src/app/manifest.ts
fi
