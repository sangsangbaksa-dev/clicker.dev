import { ButtonLink } from "@/components/ui/button-link"
import { Shield } from "lucide-react"

export function AdminAccessDenied({
  message,
  backHref = "/",
  backLabel = "홈으로",
}: {
  message: string
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-16 text-center">
      <Shield className="mx-auto size-8 text-muted-foreground" />
      <h1 className="text-base font-semibold">접근 권한 없음</h1>
      <p className="text-sm leading-6 text-muted-foreground">{message}</p>
      <ButtonLink href={backHref} variant="outline">
        {backLabel}
      </ButtonLink>
    </div>
  )
}
