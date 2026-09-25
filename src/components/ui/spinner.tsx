import { cn } from "@/shared/utils"

const sizeClass = {
  xs: "size-3 border-[1.5px]",
  sm: "size-3.5 border-2",
  md: "size-4 border-2",
} as const

export function Spinner({
  size = "sm",
  className,
  label = "불러오는 중",
}: {
  size?: keyof typeof sizeClass
  className?: string
  label?: string
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full border-solid border-primary/20 border-t-primary",
        sizeClass[size],
        className
      )}
    />
  )
}
