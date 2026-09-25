import { SettingsAccountCard } from "@/components/settings/settings-account-card"
import { defaultBoardHref } from "@/shared/approved-landing"
import { getAuthUserFromCookies } from "@/infrastructure/auth/server"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const user = await getAuthUserFromCookies()
  if (!user) {
    redirect("/login?next=/settings")
  }
  if (user.status === "pending") {
    redirect("/pending")
  }

  const backHref = defaultBoardHref(user)
  const backLabel = backHref !== "/" ? "내 반" : "홈"

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        {backLabel}
      </Link>

      <h1 className="text-base font-semibold">설정</h1>

      <SettingsAccountCard initialUser={user} />
    </div>
  )
}
