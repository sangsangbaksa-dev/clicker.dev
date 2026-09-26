"use client"

import { useEffect } from "react"

/** 루트 레이아웃까지 실패했을 때의 마지막 안전망. 전역 스타일이 없으므로 인라인 스타일만 쓴다. */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0b0d12",
          color: "#e7e9ee",
        }}
      >
        <title>문제가 생겼습니다</title>
        <div style={{ textAlign: "center", padding: 24, maxWidth: 420 }}>
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>문제가 생겼습니다</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.75, margin: "0 0 16px" }}>
            잠시 후 다시 시도해 주세요. 저장된 진행 상황은 그대로 남아 있습니다.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              fontSize: 14,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #3a3f4b",
              background: "#1a1e27",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
          {error.digest ? (
            <p style={{ fontSize: 12, opacity: 0.5, marginTop: 16 }}>오류 코드 {error.digest}</p>
          ) : null}
        </div>
      </body>
    </html>
  )
}
