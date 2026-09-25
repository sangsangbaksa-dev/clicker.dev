"use client"

import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"

export function SwitchAccountLink({ className }: { className?: string }) {
  const router = useRouter()
  const { logout } = useAuth()

  return (
    <button
      type="button"
      className={className ?? "text-primary hover:underline"}
      onClick={() => {
        void (async () => {
          await logout()
          router.replace("/login")
        })()
      }}
    >
      다른 계정으로 로그인
    </button>
  )
}
