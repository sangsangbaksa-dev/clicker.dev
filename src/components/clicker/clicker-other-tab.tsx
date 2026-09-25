"use client"

import { useRef } from "react"
import { useClickerDialogFocus } from "@/components/clicker/clicker-a11y"

type Props = {
  onResume: () => void
}

/** Shown in a tab that lost the save to another tab, so the two never overwrite each other. */
export function ClickerOtherTab({ onResume }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  useClickerDialogFocus(ref, true)
  return (
    <div data-clicker className="clicker-shell">
      <div className="clicker-welcome-scrim">
        <div
          ref={ref}
          className="clicker-welcome"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clicker-other-tab-title"
        >
          <p className="clicker-welcome-kicker">PAUSED</p>
          <h2 id="clicker-other-tab-title">다른 탭에서 게임이 실행 중입니다</h2>
          <p className="clicker-welcome-hint">
            진행 상황이 서로 덮어쓰이지 않도록 이 탭은 멈췄습니다. 여기서 계속하면 다른 탭의 진행 상황을 불러오고 그 탭이 멈춥니다.
          </p>
          <div className="clicker-welcome-actions">
            <button type="button" className="clicker-primary" onClick={onResume}>
              이 탭에서 계속하기
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
