#!/usr/bin/env bash
set -euo pipefail

# Push this Cursor Origin repo to GitHub so Cloudflare Workers Git
# integration can attach. Cloudflare cannot connect to Origin remotes.
#
# Usage:
#   GITHUB_TOKEN=ghp_... ./scripts/mirror-to-github.sh OWNER/hsms-md

REPO="${1:-${GITHUB_REPOSITORY:-}}"
if [[ -z "$REPO" || "$REPO" != */* ]]; then
  echo "Usage: GITHUB_TOKEN=... $0 owner/hsms-md" >&2
  exit 1
fi
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "GITHUB_TOKEN is required (create repo + push)." >&2
  exit 1
fi

NAME="${REPO#*/}"
API="https://api.github.com/repos/${REPO}"
AUTH=( -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" )

status="$(curl -sS -o /tmp/hsms-github-repo.json -w "%{http_code}" "${AUTH[@]}" "$API")"
if [[ "$status" == "404" ]]; then
  echo "Creating GitHub repository ${REPO}..."
  create_status="$(
    curl -sS -o /tmp/hsms-github-create.json -w "%{http_code}" "${AUTH[@]}" \
      https://api.github.com/user/repos \
      -d "{\"name\":\"${NAME}\",\"private\":true,\"description\":\"화산중 수행평가 보드\"}"
  )"
  if [[ "$create_status" != "201" ]]; then
    echo "Could not create ${REPO} (HTTP ${create_status})." >&2
    cat /tmp/hsms-github-create.json >&2
    exit 1
  fi
elif [[ "$status" != "200" ]]; then
  echo "GitHub API error for ${REPO} (HTTP ${status})." >&2
  cat /tmp/hsms-github-repo.json >&2
  exit 1
fi

git remote remove github 2>/dev/null || true
git remote add github "https://x-access-token:${GITHUB_TOKEN}@github.com/${REPO}.git"
git push -u github HEAD:main
echo "Mirrored to https://github.com/${REPO}"
