"use client"

import Link from "next/link"
import { useEffect } from "react"

/** 페이지 렌더 중 오류가 나도 흰 화면 대신 복구 버튼을 보여 준다. 게임 저장은 브라우저에 남아 있다. */
export default function ErrorPage({
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
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h1 className="text-base font-semibold">문제가 생겼습니다</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        잠시 후 다시 시도해 주세요. 저장된 진행 상황은 그대로 남아 있습니다.
      </p>
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => retry()}
          className="text-sm font-medium text-primary hover:underline"
        >
          다시 시도
        </button>
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          첫 화면
        </Link>
      </div>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">오류 코드 {error.digest}</p>
      ) : null}
    </div>
  )
}
