import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/shared/utils"

export function PageLoading({
  className,
  label,
}: {
  className?: string
  label?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center py-16 sm:py-20",
        className
      )}
    >
      <Spinner size="sm" label={label} />
    </div>
  )
}
