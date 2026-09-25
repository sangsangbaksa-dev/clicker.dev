"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"

export function SettingsLogoutButton() {
  const router = useRouter()
  const { logout } = useAuth()

  async function handleLogout() {
    await logout()
    router.replace("/")
  }

  return (
    <Button variant="destructive" className="w-full" onClick={() => void handleLogout()}>
      <LogOut />
      로그아웃
    </Button>
  )
}
